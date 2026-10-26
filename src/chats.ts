import { randomBytes } from 'node:crypto';

import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import {
  CALL_OPTIONS,
  COOLDOWN_SECONDS,
  EMERGENCY_COOLDOWN_SECONDS,
  MAX_GROUP_DESCRIPTION,
  MAX_GROUP_TITLE,
  MAX_MESSAGE_LENGTH,
  MAX_STORED_UNLOCKS,
  db,
  isRecord,
  pairId,
  toMillis,
} from './config';
import { notifyGroupJoined } from './notifications';

function requiredUid(request: { auth?: { uid?: string } }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  return uid;
}

function memberIdsOf(chat: Record<string, unknown>): string[] {
  return Array.isArray(chat.memberIds)
    ? chat.memberIds.filter((value): value is string => typeof value === 'string')
    : [];
}

function validateChatId(value: unknown): string {
  const chatId = typeof value === 'string' ? value : '';
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(chatId)) {
    throw new HttpsError('invalid-argument', 'Chat inválido.');
  }
  return chatId;
}

export const sendMessage = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const chatId = validateChatId(data.chatId);
  const text = typeof data.text === 'string' ? data.text.trim() : '';
  const emergency = data.emergency === true;
  const clientId =
    typeof data.clientId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(data.clientId)
      ? data.clientId
      : null;

  if (!text) throw new HttpsError('invalid-argument', 'El mensaje está vacío.');
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new HttpsError(
      'invalid-argument',
      `El mensaje supera los ${MAX_MESSAGE_LENGTH} caracteres.`
    );
  }

  const chatRef = db().doc(`chats/${chatId}`);
  const memberRef = chatRef.collection('members').doc(uid);
  const userRef = db().doc(`users/${uid}`);
  const configRef = db().doc('config/chat');
  const messageRef = chatRef.collection('messages').doc();

  return db().runTransaction(async (tx) => {
    const [chatSnap, memberSnap, userSnap, configSnap] = await Promise.all([
      tx.get(chatRef),
      tx.get(memberRef),
      tx.get(userRef),
      tx.get(configRef),
    ]);

    if (!chatSnap.exists) throw new HttpsError('not-found', 'El chat no existe.');
    if (!memberSnap.exists) {
      throw new HttpsError('permission-denied', 'No perteneces a este chat.');
    }
    if (userSnap.get('suspended') === true) {
      throw new HttpsError('permission-denied', 'Tu cuenta está suspendida por moderación.');
    }

    const chat = chatSnap.data() ?? {};
    const chatMembers = memberIdsOf(chat);
    if (!chatMembers.includes(uid)) {
      throw new HttpsError('permission-denied', 'No perteneces a este chat.');
    }

    if (chat.type === 'direct') {
      const otherUid = chatMembers.find((memberId) => memberId !== uid);
      if (!otherUid) throw new HttpsError('failed-precondition', 'Chat directo inválido.');

      const [blockAB, blockBA, friendship] = await Promise.all([
        tx.get(db().doc(`blocks/${uid}_${otherUid}`)),
        tx.get(db().doc(`blocks/${otherUid}_${uid}`)),
        tx.get(db().doc(`friendships/${pairId(uid, otherUid)}`)),
      ]);

      if (blockAB.exists || blockBA.exists) {
        throw new HttpsError('permission-denied', 'No puedes escribir en este chat.');
      }
      if (!friendship.exists) {
        throw new HttpsError('failed-precondition', 'Solo puedes escribir a tus amistades.');
      }
    }

    const now = Date.now();
    const lastMessageAt = toMillis(userSnap.get('lastMessageAt'));
    const lastEmergencyAt = toMillis(userSnap.get('lastEmergencyAt'));
    const storedUnlocks = Math.min(
      MAX_STORED_UNLOCKS,
      Math.max(0, Math.floor(Number(userSnap.get('unlocks')) || 0))
    );
    const cooldownMs =
      Math.max(1, Number(configSnap.get('cooldownSeconds')) || COOLDOWN_SECONDS) * 1000;
    const emergencyCooldownMs =
      Math.max(1, Number(configSnap.get('emergencyCooldownSeconds')) || EMERGENCY_COOLDOWN_SECONDS) *
      1000;

    let usesUnlock = false;
    if (emergency) {
      if (lastEmergencyAt && now - lastEmergencyAt < emergencyCooldownMs) {
        throw new HttpsError(
          'resource-exhausted',
          'La alerta de emergencia ya fue usada. Puedes volver a usarla en unos minutos.',
          { nextAllowedAt: lastEmergencyAt + emergencyCooldownMs }
        );
      }
    } else if (lastMessageAt && now - lastMessageAt < cooldownMs) {
      if (storedUnlocks < 1) {
        throw new HttpsError(
          'resource-exhausted',
          `Espera ${Math.ceil((cooldownMs - (now - lastMessageAt)) / 1000)} s o desbloquea un envío.`,
          { nextAllowedAt: lastMessageAt + cooldownMs }
        );
      }
      usesUnlock = true;
    }

    const message = {
      senderId: uid,
      text,
      emergency,
      clientId,
      createdAt: FieldValue.serverTimestamp(),
    };

    tx.set(messageRef, message);
    tx.set(
      chatRef,
      {
        lastMessageText: text.slice(0, 140),
        lastMessageAt: FieldValue.serverTimestamp(),
        lastMessageSenderId: uid,
        updatedAt: now,
      },
      { merge: true }
    );
    tx.set(memberRef, { lastReadAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(
      userRef,
      {
        lastMessageAt: now,
        lastEmergencyAt: emergency ? now : lastEmergencyAt || null,
        unlocks: usesUnlock ? storedUnlocks - 1 : storedUnlocks,
        updatedAt: now,
      },
      { merge: true }
    );

    for (const memberId of chatMembers) {
      const indexRef = db().doc(`users/${memberId}/chatIndex/${chatId}`);
      tx.set(
        indexRef,
        {
          chatId,
          type: chat.type ?? 'group',
          title: chat.title ?? '',
          photoURL: chat.photoURL ?? null,
          lastMessageText: text.slice(0, 140),
          lastMessageAt: FieldValue.serverTimestamp(),
          lastMessageSenderId: uid,
          unreadCount: memberId === uid ? 0 : FieldValue.increment(1),
          updatedAt: now,
        },
        { merge: true }
      );
    }

    return {
      messageId: messageRef.id,
      usedUnlock: usesUnlock,
      emergency,
      nextAllowedAt:
        emergency ? now + emergencyCooldownMs : now + cooldownMs,
    };
  });
});

export const markChatRead = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const chatId = validateChatId(data.chatId);
  const memberRef = db().doc(`chats/${chatId}/members/${uid}`);
  const indexRef = db().doc(`users/${uid}/chatIndex/${chatId}`);

  await db().runTransaction(async (tx) => {
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists) {
      throw new HttpsError('permission-denied', 'No perteneces a este chat.');
    }
    tx.set(memberRef, { lastReadAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(indexRef, { unreadCount: 0, updatedAt: Date.now() }, { merge: true });
  });

  return { read: true };
});

export const createDirectChat = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const otherUid = typeof data.uid === 'string' ? data.uid : '';
  if (!otherUid || otherUid === uid) {
    throw new HttpsError('invalid-argument', 'Usuario inválido.');
  }

  const pair = pairId(uid, otherUid);
  const chatId = `direct_${pair}`;
  const chatRef = db().doc(`chats/${chatId}`);
  const otherProfileRef = db().doc(`publicProfiles/${otherUid}`);
  const friendshipRef = db().doc(`friendships/${pair}`);
  const now = Date.now();

  return db().runTransaction(async (tx) => {
    const [chatSnap, friendshipSnap, blockAB, blockBA, profileSnap] = await Promise.all([
      tx.get(chatRef),
      tx.get(friendshipRef),
      tx.get(db().doc(`blocks/${uid}_${otherUid}`)),
      tx.get(db().doc(`blocks/${otherUid}_${uid}`)),
      tx.get(otherProfileRef),
    ]);

    if (blockAB.exists || blockBA.exists) {
      throw new HttpsError('permission-denied', 'No puedes abrir este chat.');
    }
    if (!friendshipSnap.exists) {
      throw new HttpsError('failed-precondition', 'Primero deben ser amistades.');
    }
    if (chatSnap.exists) return { chatId };

    const memberIds = [uid, otherUid].sort();
    const title = profileSnap.get('displayName') ?? 'Chat directo';
    const photoURL = profileSnap.get('photoURL') ?? null;
    tx.set(chatRef, {
      type: 'direct',
      title,
      photoURL,
      memberIds,
      inviteCode: null,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
      lastMessageText: '',
      lastMessageSenderId: null,
      lastMessageAt: 0,
    });
    for (const memberId of memberIds) {
      tx.set(chatRef.collection('members').doc(memberId), {
        uid: memberId,
        role: 'member',
        joinedAt: now,
        lastReadAt: now,
      });
      tx.set(db().doc(`users/${memberId}/chatIndex/${chatId}`), {
        chatId,
        type: 'direct',
        title,
        photoURL,
        lastMessageText: '',
        lastMessageSenderId: null,
        lastMessageAt: 0,
        unreadCount: 0,
        updatedAt: now,
      });
    }

    return { chatId };
  });
});

export const createGroup = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (title.length < 2 || title.length > MAX_GROUP_TITLE) {
    throw new HttpsError(
      'invalid-argument',
      `El nombre del grupo debe tener entre 2 y ${MAX_GROUP_TITLE} caracteres.`
    );
  }

  const description = typeof data.description === 'string' ? data.description.trim() : '';
  if (description.length > MAX_GROUP_DESCRIPTION) {
    throw new HttpsError(
      'invalid-argument',
      `La descripción no puede superar ${MAX_GROUP_DESCRIPTION} caracteres.`
    );
  }

  const chatRef = db().collection('chats').doc();
  const chatId = chatRef.id;
  const inviteCode = randomBytes(5).toString('hex').toUpperCase();
  const now = Date.now();

  await db().runTransaction(async (tx) => {
    tx.set(chatRef, {
      type: 'group',
      title,
      description,
      photoURL: null,
      memberIds: [uid],
      inviteCode,
      createdBy: uid,
      createdAt: now,
      updatedAt: now,
      lastMessageText: '',
      lastMessageSenderId: null,
      lastMessageAt: 0,
    });
    tx.set(chatRef.collection('members').doc(uid), {
      uid,
      role: 'owner',
      joinedAt: now,
      lastReadAt: now,
    });
    tx.set(db().doc(`users/${uid}/chatIndex/${chatId}`), {
      chatId,
      type: 'group',
      title,
      photoURL: null,
      lastMessageText: '',
      lastMessageSenderId: null,
      lastMessageAt: 0,
      unreadCount: 0,
      updatedAt: now,
    });
  });

  return { chatId, inviteCode };
});

export const leaveGroup = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const chatId = validateChatId(data.chatId);
  const chatRef = db().doc(`chats/${chatId}`);
  const memberRef = chatRef.collection('members').doc(uid);
  const now = Date.now();

  await db().runTransaction(async (tx) => {
    const [chatSnap, memberSnap] = await Promise.all([tx.get(chatRef), tx.get(memberRef)]);
    if (!chatSnap.exists || chatSnap.get('type') !== 'group') {
      throw new HttpsError('not-found', 'El grupo ya no existe.');
    }
    if (!memberSnap.exists) {
      throw new HttpsError('permission-denied', 'No perteneces a este grupo.');
    }

    const chat = chatSnap.data() ?? {};
    const members = memberIdsOf(chat).filter((memberId) => memberId !== uid);
    tx.delete(memberRef);
    tx.delete(db().doc(`users/${uid}/chatIndex/${chatId}`));

    if (members.length === 0) {
      tx.delete(chatRef);
      return;
    }

    const nextOwner = chat.createdBy === uid ? members[0] : null;
    if (nextOwner) {
      tx.set(
        chatRef.collection('members').doc(nextOwner),
        { role: 'owner' },
        { merge: true }
      );
    }
    tx.set(
      chatRef,
      {
        memberIds: members,
        ...(nextOwner ? { createdBy: nextOwner } : {}),
        updatedAt: now,
      },
      { merge: true }
    );
  });

  return { left: true };
});

export const updateGroup = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const chatId = validateChatId(data.chatId);
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (title.length < 2 || title.length > MAX_GROUP_TITLE) {
    throw new HttpsError(
      'invalid-argument',
      `El nombre del grupo debe tener entre 2 y ${MAX_GROUP_TITLE} caracteres.`
    );
  }
  const description = typeof data.description === 'string' ? data.description.trim() : '';
  if (description.length > MAX_GROUP_DESCRIPTION) {
    throw new HttpsError(
      'invalid-argument',
      `La descripción no puede superar ${MAX_GROUP_DESCRIPTION} caracteres.`
    );
  }

  const chatRef = db().doc(`chats/${chatId}`);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists || chatSnap.get('type') !== 'group') {
    throw new HttpsError('not-found', 'El grupo ya no existe.');
  }
  if (chatSnap.get('createdBy') !== uid) {
    throw new HttpsError('permission-denied', 'Solo el creador puede editar el grupo.');
  }

  const now = Date.now();
  const members = memberIdsOf(chatSnap.data() ?? {});
  const batch = db().batch();
  batch.set(chatRef, { title, description, updatedAt: now }, { merge: true });
  for (const memberId of members) {
    batch.set(db().doc(`users/${memberId}/chatIndex/${chatId}`), { title, updatedAt: now }, { merge: true });
  }
  await batch.commit();
  return { title, description };
});

export const regenerateInviteCode = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const chatId = validateChatId(data.chatId);
  const chatRef = db().doc(`chats/${chatId}`);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists || chatSnap.get('type') !== 'group') {
    throw new HttpsError('not-found', 'El grupo ya no existe.');
  }
  if (chatSnap.get('createdBy') !== uid) {
    throw new HttpsError('permission-denied', 'Solo el creador puede cambiar el código.');
  }

  const inviteCode = randomBytes(5).toString('hex').toUpperCase();
  await chatRef.set({ inviteCode, updatedAt: Date.now() }, { merge: true });
  return { inviteCode };
});

export const removeGroupMember = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const chatId = validateChatId(data.chatId);
  const memberUid = typeof data.uid === 'string' ? data.uid : '';
  if (!memberUid || memberUid === uid) {
    throw new HttpsError('invalid-argument', 'Miembro inválido.');
  }

  const chatRef = db().doc(`chats/${chatId}`);
  await db().runTransaction(async (tx) => {
    const chatSnap = await tx.get(chatRef);
    if (!chatSnap.exists || chatSnap.get('type') !== 'group') {
      throw new HttpsError('not-found', 'El grupo ya no existe.');
    }
    if (chatSnap.get('createdBy') !== uid) {
      throw new HttpsError('permission-denied', 'Solo el creador puede expulsar miembros.');
    }
    const members = memberIdsOf(chatSnap.data() ?? {});
    if (!members.includes(memberUid)) {
      throw new HttpsError('not-found', 'Ese miembro ya no está en el grupo.');
    }

    tx.set(chatRef, { memberIds: members.filter((id) => id !== memberUid), updatedAt: Date.now() }, { merge: true });
    tx.delete(chatRef.collection('members').doc(memberUid));
    tx.delete(db().doc(`users/${memberUid}/chatIndex/${chatId}`));
  });

  return { removed: true };
});

export const deleteGroup = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const chatId = validateChatId(data.chatId);
  const chatRef = db().doc(`chats/${chatId}`);
  const chatSnap = await chatRef.get();
  if (!chatSnap.exists || chatSnap.get('type') !== 'group') {
    throw new HttpsError('not-found', 'El grupo ya no existe.');
  }
  if (chatSnap.get('createdBy') !== uid) {
    throw new HttpsError('permission-denied', 'Solo el creador puede eliminar el grupo.');
  }

  const members = memberIdsOf(chatSnap.data() ?? {});
  const batch = db().batch();
  for (const memberId of members) {
    batch.delete(db().doc(`users/${memberId}/chatIndex/${chatId}`));
    batch.delete(chatRef.collection('members').doc(memberId));
  }
  batch.delete(chatRef);
  await batch.commit();
  return { deleted: true };
});

export const joinGroupByCode = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const inviteCode =
    typeof data.inviteCode === 'string' ? data.inviteCode.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{4,16}$/.test(inviteCode)) {
    throw new HttpsError('invalid-argument', 'Código de invitación inválido.');
  }

  const matches = await db()
    .collection('chats')
    .where('inviteCode', '==', inviteCode)
    .limit(1)
    .get();
  if (matches.empty) throw new HttpsError('not-found', 'No encontramos ese grupo.');
  const chatRef = matches.docs[0].ref;
  const chatId = chatRef.id;
  const memberRef = chatRef.collection('members').doc(uid);
  const now = Date.now();

  const result = await db().runTransaction(async (tx) => {
    const [chatSnap, memberSnap] = await Promise.all([tx.get(chatRef), tx.get(memberRef)]);
    if (!chatSnap.exists || chatSnap.get('type') !== 'group') {
      throw new HttpsError('not-found', 'No encontramos ese grupo.');
    }
    if (memberSnap.exists) return { chatId, joined: false, title: '' };

    const chat = chatSnap.data() ?? {};
    const members = memberIdsOf(chat);
    if (members.length >= 50) {
      throw new HttpsError('resource-exhausted', 'El grupo alcanzó el límite de miembros.');
    }

    tx.set(chatRef, { memberIds: [...members, uid].sort(), updatedAt: now }, { merge: true });
    tx.set(memberRef, {
      uid,
      role: 'member',
      joinedAt: now,
      lastReadAt: now,
    });
    tx.set(db().doc(`users/${uid}/chatIndex/${chatId}`), {
      chatId,
      type: 'group',
      title: chat.title ?? 'Grupo',
      photoURL: chat.photoURL ?? null,
      lastMessageText: chat.lastMessageText ?? '',
      lastMessageSenderId: chat.lastMessageSenderId ?? null,
      lastMessageAt: chat.lastMessageAt ?? 0,
      unreadCount: 0,
      updatedAt: now,
    });

    return { chatId, joined: true, title: String(chat.title ?? 'Grupo') };
  });

  if (result.joined) {
    await notifyGroupJoined(uid, chatId, result.title).catch(() => undefined);
  }

  return { chatId };
});
