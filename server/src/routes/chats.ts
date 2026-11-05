import { Router } from 'express';
import { publicErrorMessage } from '../lib/public-error';
import {
  applyUnlockConsumption,
  checkEmergencyCooldown,
  checkNormalCooldown,
  computeStoredUnlocks,
  calculateCooldownMs,
} from '../lib/chat-policy';
import {
  COOLDOWN_SECONDS,
  EMERGENCY_COOLDOWN_SECONDS,
  MAX_STORED_UNLOCKS,
  toMillis,
} from '../lib/chat-config';
import { db } from '../lib/firebase-admin';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';

const router = Router();

const MAX_GROUP_TITLE = 60;
const MAX_GROUP_DESCRIPTION = 280;
const MAX_MESSAGE_LENGTH = 1000;
const GLOBAL_CHAT_ID = 'global_sala_comunitaria';

function pairId(a: string, b: string) {
  return [a, b].sort().join('_');
}

function memberIdsOf(chat: any): string[] {
  return Array.isArray(chat.memberIds)
    ? chat.memberIds.filter((value: any) => typeof value === 'string')
    : [];
}

function validateChatId(value: unknown): string {
  const chatId = typeof value === 'string' ? value : '';
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(chatId)) {
    throw new Error('Chat inválido.');
  }
  return chatId;
}

router.post('/joinGlobalChat', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const chatRef = db().doc(`chats/${GLOBAL_CHAT_ID}`);
    const memberRef = chatRef.collection('members').doc(uid);
    const indexRef = db().doc(`users/${uid}/chatIndex/${GLOBAL_CHAT_ID}`);
    const now = Date.now();

    await db().runTransaction(async (tx) => {
      const [chatSnap, memberSnap] = await Promise.all([tx.get(chatRef), tx.get(memberRef)]);

      if (!chatSnap.exists) {
        tx.set(chatRef, {
          type: 'group',
          title: 'Sala Comunitaria',
          description: 'Lugar abierto para hablar con toda la comunidad.',
          photoURL: null,
          memberIds: [uid],
          inviteCode: null,
          createdBy: 'system',
          createdAt: now,
          updatedAt: now,
          lastMessageText: '',
          lastMessageSenderId: null,
          lastMessageAt: 0,
        });
      } else {
        const members = memberIdsOf(chatSnap.data() || {});
        if (!members.includes(uid)) {
          tx.set(chatRef, { memberIds: [...members, uid].sort(), updatedAt: now }, { merge: true });
        }
      }

      if (!memberSnap.exists) {
        tx.set(memberRef, { uid, role: 'member', joinedAt: now, lastReadAt: now });
      }

      const chat = chatSnap.exists ? chatSnap.data() || {} : {};
      tx.set(
        indexRef,
        {
          chatId: GLOBAL_CHAT_ID,
          type: 'group',
          title: chat.title ?? 'Sala Comunitaria',
          photoURL: chat.photoURL ?? null,
          lastMessageText: chat.lastMessageText ?? '',
          lastMessageSenderId: chat.lastMessageSenderId ?? null,
          lastMessageAt: chat.lastMessageAt ?? 0,
          unreadCount: 0,
          updatedAt: now,
        },
        { merge: true }
      );
    });

    res.json({ chatId: GLOBAL_CHAT_ID });
  } catch (e: any) {
    res.status(400).json({ message: publicErrorMessage(e, 'Error al abrir la sala global') });
  }
});

router.post('/createDirectChat', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const otherUid = typeof req.body?.uid === 'string' ? req.body.uid : '';
    if (!otherUid || otherUid === uid) throw new Error('Usuario inválido.');

    const pair = pairId(uid, otherUid);
    const chatId = `direct_${pair}`;
    const chatRef = db().doc(`chats/${chatId}`);
    const otherProfileRef = db().doc(`publicProfiles/${otherUid}`);
    const friendshipRef = db().doc(`friendships/${pair}`);
    const now = Date.now();

    const result = await db().runTransaction(async (tx) => {
      const [chatSnap, friendshipSnap, blockAB, blockBA, profileSnap] = await Promise.all([
        tx.get(chatRef),
        tx.get(friendshipRef),
        tx.get(db().doc(`blocks/${uid}_${otherUid}`)),
        tx.get(db().doc(`blocks/${otherUid}_${uid}`)),
        tx.get(otherProfileRef),
      ]);

      if (blockAB.exists || blockBA.exists) throw new Error('No puedes abrir este chat.');
      if (!friendshipSnap.exists) throw new Error('Primero deben ser amistades.');
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
        tx.set(chatRef.collection('members').doc(memberId), { uid: memberId, role: 'member', joinedAt: now, lastReadAt: now });
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

    res.json(result);
  } catch (e: any) {
    res.status(400).json({ message: publicErrorMessage(e, 'Error al crear chat') });
  }
});

router.post('/createGroup', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (title.length < 2 || title.length > MAX_GROUP_TITLE) {
      throw new Error(`El nombre del grupo debe tener entre 2 y ${MAX_GROUP_TITLE} caracteres.`);
    }

    const chatRef = db().collection('chats').doc();
    const chatId = chatRef.id;
    const inviteCode = randomBytes(5).toString('hex').toUpperCase();
    const now = Date.now();

    await db().runTransaction(async (tx) => {
      tx.set(chatRef, {
        type: 'group',
        title,
        description: '',
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
      tx.set(chatRef.collection('members').doc(uid), { uid, role: 'owner', joinedAt: now, lastReadAt: now });
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

    res.json({ chatId, inviteCode });
  } catch (e: any) {
    res.status(400).json({ message: publicErrorMessage(e, 'Error al crear grupo') });
  }
});

router.post('/joinGroupByCode', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const inviteCode = typeof req.body?.inviteCode === 'string' ? req.body.inviteCode.trim().toUpperCase() : '';
    if (!/^[A-Z0-9]{4,16}$/.test(inviteCode)) throw new Error('Código de invitación inválido.');

    const matches = await db().collection('chats').where('inviteCode', '==', inviteCode).limit(1).get();
    if (matches.empty) throw new Error('No encontramos ese grupo.');
    const chatRef = matches.docs[0].ref;
    const chatId = chatRef.id;
    const memberRef = chatRef.collection('members').doc(uid);
    const now = Date.now();

    await db().runTransaction(async (tx) => {
      const [chatSnap, memberSnap] = await Promise.all([tx.get(chatRef), tx.get(memberRef)]);
      if (!chatSnap.exists || chatSnap.get('type') !== 'group') throw new Error('No encontramos ese grupo.');
      if (memberSnap.exists) return;
      const chat = chatSnap.data() || {};
      const members = memberIdsOf(chat);
      if (members.length >= 50) throw new Error('El grupo alcanzó el límite de miembros.');
      tx.set(chatRef, { memberIds: [...members, uid].sort(), updatedAt: now }, { merge: true });
      tx.set(memberRef, { uid, role: 'member', joinedAt: now, lastReadAt: now });
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
    });

    res.json({ chatId });
  } catch (e: any) {
    res.status(400).json({ message: publicErrorMessage(e, 'Error al unirse al grupo') });
  }
});

router.post('/sendMessage', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const data = req.body || {};
    const chatId = validateChatId(data.chatId);
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    const emergency = data.emergency === true;
    const clientId =
      typeof data.clientId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(data.clientId)
        ? data.clientId
        : null;
    if (!text) throw new Error('El mensaje está vacío.');
    if (text.length > MAX_MESSAGE_LENGTH) throw new Error(`El mensaje supera los ${MAX_MESSAGE_LENGTH} caracteres.`);

    const chatRef = db().doc(`chats/${chatId}`);
    const memberRef = chatRef.collection('members').doc(uid);
    const userRef = db().doc(`users/${uid}`);
    const configRef = db().doc('config/chat');
    const messageRef = chatRef.collection('messages').doc();

    const result = await db().runTransaction(async (tx) => {
      const [chatSnap, memberSnap, userSnap, configSnap] = await Promise.all([
        tx.get(chatRef),
        tx.get(memberRef),
        tx.get(userRef),
        tx.get(configRef),
      ]);
      if (!chatSnap.exists) throw new Error('El chat no existe.');
      if (!memberSnap.exists) throw new Error('No perteneces a este chat.');
      if (userSnap.get('suspended') === true) {
        throw new Error('Tu cuenta está suspendida por moderación.');
      }

      const chat = chatSnap.data() || {};
      const chatMembers = memberIdsOf(chat);
      if (!chatMembers.includes(uid)) {
        throw new Error('No perteneces a este chat.');
      }

      if (chat.type === 'direct' || chatId.startsWith('direct_')) {
        const otherUid = chatMembers.find((memberId) => memberId !== uid);
        if (!otherUid) throw new Error('Chat directo inválido.');

        const [blockAB, blockBA, friendship] = await Promise.all([
          tx.get(db().doc(`blocks/${uid}_${otherUid}`)),
          tx.get(db().doc(`blocks/${otherUid}_${uid}`)),
          tx.get(db().doc(`friendships/${pairId(uid, otherUid)}`)),
        ]);

        if (blockAB.exists || blockBA.exists) {
          throw new Error('No puedes escribir en este chat.');
        }
        if (!friendship.exists) {
          throw new Error('Solo puedes escribir a tus amistades.');
        }
      }

      const now = Date.now();
      const lastMessageAt = toMillis(userSnap.get('lastMessageAt'));
      const lastEmergencyAt = toMillis(userSnap.get('lastEmergencyAt'));
      const storedUnlocks = computeStoredUnlocks(
        userSnap.get('unlocks'),
        MAX_STORED_UNLOCKS
      );
      const cooldownMs = calculateCooldownMs(
        configSnap.get('cooldownSeconds'),
        COOLDOWN_SECONDS
      );
      const emergencyCooldownMs = calculateCooldownMs(
        configSnap.get('emergencyCooldownSeconds'),
        EMERGENCY_COOLDOWN_SECONDS
      );

      let usesUnlock = false;
      if (emergency) {
        const emergencyCheck = checkEmergencyCooldown(
          lastEmergencyAt,
          now,
          emergencyCooldownMs
        );
        if (!emergencyCheck.allowed) {
          return {
            ok: false as const,
            message: emergencyCheck.message,
            nextAllowedAt: emergencyCheck.nextAllowedAt,
          };
        }
      } else {
        const normalCheck = checkNormalCooldown(
          lastMessageAt,
          now,
          cooldownMs,
          storedUnlocks
        );
        if (!normalCheck.allowed) {
          return {
            ok: false as const,
            message: normalCheck.message,
            nextAllowedAt: normalCheck.nextAllowedAt,
          };
        }
        usesUnlock = normalCheck.consumeUnlock === true;
      }

      tx.set(messageRef, {
        senderId: uid,
        text,
        emergency,
        clientId,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(chatRef, { lastMessageText: text.slice(0, 140), lastMessageAt: FieldValue.serverTimestamp(), lastMessageSenderId: uid, updatedAt: now }, { merge: true });
      tx.set(memberRef, { lastReadAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(userRef, {
        lastMessageAt: now,
        lastEmergencyAt: emergency ? now : lastEmergencyAt || null,
        unlocks: applyUnlockConsumption(storedUnlocks, usesUnlock),
        updatedAt: now,
      }, { merge: true });

      for (const memberId of chatMembers) {
        const indexRef = db().doc(`users/${memberId}/chatIndex/${chatId}`);
        tx.set(indexRef, {
          chatId,
          type: chat.type ?? 'group',
          title: chat.title ?? 'Sala Comunitaria',
          photoURL: chat.photoURL ?? null,
          lastMessageText: text.slice(0, 140),
          lastMessageAt: FieldValue.serverTimestamp(),
          lastMessageSenderId: uid,
          unreadCount: memberId === uid ? 0 : FieldValue.increment(1),
          updatedAt: now,
        }, { merge: true });
      }

      return {
        ok: true as const,
        messageId: messageRef.id,
        usedUnlock: usesUnlock,
        nextAllowedAt: emergency ? now + emergencyCooldownMs : now + cooldownMs,
      };
    });

    if (!result.ok) {
      return res.status(429).json({
        message: result.message,
        details: { nextAllowedAt: result.nextAllowedAt },
      });
    }

    res.json({
      messageId: result.messageId,
      usedUnlock: result.usedUnlock,
      nextAllowedAt: result.nextAllowedAt,
    });
  } catch (e: any) {
    res.status(400).json({ message: publicErrorMessage(e, 'Error al enviar mensaje') });
  }
});

router.post('/markChatRead', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const chatId = validateChatId(req.body?.chatId);
    const memberRef = db().doc(`chats/${chatId}/members/${uid}`);
    const indexRef = db().doc(`users/${uid}/chatIndex/${chatId}`);
    await db().runTransaction(async (tx) => {
      const memberSnap = await tx.get(memberRef);
      if (!memberSnap.exists) throw new Error('No perteneces a este chat.');
      tx.set(memberRef, { lastReadAt: FieldValue.serverTimestamp() }, { merge: true });
      tx.set(indexRef, { unreadCount: 0, updatedAt: Date.now() }, { merge: true });
    });
    res.json({ read: true });
  } catch (e: any) {
    res.status(400).json({ message: publicErrorMessage(e, 'Error al marcar como leído') });
  }
});

router.post('/leaveGroup', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const chatId = validateChatId(req.body?.chatId);
    const chatRef = db().doc(`chats/${chatId}`);
    const memberRef = chatRef.collection('members').doc(uid);
    const now = Date.now();

    await db().runTransaction(async (tx) => {
      const [chatSnap, memberSnap] = await Promise.all([tx.get(chatRef), tx.get(memberRef)]);
      if (!chatSnap.exists || chatSnap.get('type') !== 'group') {
        throw new Error('El grupo ya no existe.');
      }
      if (!memberSnap.exists) throw new Error('No perteneces a este grupo.');

      const chat = chatSnap.data() || {};
      const members = memberIdsOf(chat).filter((memberId) => memberId !== uid);
      tx.delete(memberRef);
      tx.delete(db().doc(`users/${uid}/chatIndex/${chatId}`));

      if (members.length === 0) {
        tx.delete(chatRef);
        return;
      }

      const nextOwner = chat.createdBy === uid ? members[0] : null;
      if (nextOwner) {
        tx.set(chatRef.collection('members').doc(nextOwner), { role: 'owner' }, { merge: true });
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

    res.json({ left: true });
  } catch (e: any) {
    res.status(400).json({ message: publicErrorMessage(e, 'Error al salir del grupo') });
  }
});

router.post('/updateGroup', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const chatId = validateChatId(req.body?.chatId);
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    if (title.length < 2 || title.length > MAX_GROUP_TITLE) {
      throw new Error(`El nombre del grupo debe tener entre 2 y ${MAX_GROUP_TITLE} caracteres.`);
    }
    const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    if (description.length > MAX_GROUP_DESCRIPTION) {
      throw new Error(`La descripción no puede superar ${MAX_GROUP_DESCRIPTION} caracteres.`);
    }

    const chatRef = db().doc(`chats/${chatId}`);
    const chatSnap = await chatRef.get();
    if (!chatSnap.exists || chatSnap.get('type') !== 'group') {
      throw new Error('El grupo ya no existe.');
    }
    if (chatSnap.get('createdBy') !== uid) {
      throw new Error('Solo el creador puede editar el grupo.');
    }

    const now = Date.now();
    const members = memberIdsOf(chatSnap.data() || {});
    const batch = db().batch();
    batch.set(chatRef, { title, description, updatedAt: now }, { merge: true });
    for (const memberId of members) {
      batch.set(db().doc(`users/${memberId}/chatIndex/${chatId}`), { title, updatedAt: now }, { merge: true });
    }
    await batch.commit();
    res.json({ title, description });
  } catch (e: any) {
    res.status(400).json({ message: publicErrorMessage(e, 'Error al actualizar el grupo') });
  }
});

router.post('/regenerateInviteCode', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const chatId = validateChatId(req.body?.chatId);
    const chatRef = db().doc(`chats/${chatId}`);
    const chatSnap = await chatRef.get();
    if (!chatSnap.exists || chatSnap.get('type') !== 'group') {
      throw new Error('El grupo ya no existe.');
    }
    if (chatSnap.get('createdBy') !== uid) {
      throw new Error('Solo el creador puede cambiar el código.');
    }

    const inviteCode = randomBytes(5).toString('hex').toUpperCase();
    await chatRef.set({ inviteCode, updatedAt: Date.now() }, { merge: true });
    res.json({ inviteCode });
  } catch (e: any) {
    res.status(400).json({ message: publicErrorMessage(e, 'Error al regenerar el código') });
  }
});

router.post('/removeGroupMember', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const chatId = validateChatId(req.body?.chatId);
    const memberUid = typeof req.body?.uid === 'string' ? req.body.uid : '';
    if (!memberUid || memberUid === uid) throw new Error('Miembro inválido.');

    const chatRef = db().doc(`chats/${chatId}`);
    await db().runTransaction(async (tx) => {
      const chatSnap = await tx.get(chatRef);
      if (!chatSnap.exists || chatSnap.get('type') !== 'group') {
        throw new Error('El grupo ya no existe.');
      }
      if (chatSnap.get('createdBy') !== uid) {
        throw new Error('Solo el creador puede expulsar miembros.');
      }
      const members = memberIdsOf(chatSnap.data() || {});
      if (!members.includes(memberUid)) throw new Error('Ese miembro ya no está en el grupo.');

      tx.set(
        chatRef,
        { memberIds: members.filter((id) => id !== memberUid), updatedAt: Date.now() },
        { merge: true }
      );
      tx.delete(chatRef.collection('members').doc(memberUid));
      tx.delete(db().doc(`users/${memberUid}/chatIndex/${chatId}`));
    });

    res.json({ removed: true });
  } catch (e: any) {
    res.status(400).json({ message: publicErrorMessage(e, 'Error al expulsar al miembro') });
  }
});

router.post('/deleteGroup', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const chatId = validateChatId(req.body?.chatId);
    const chatRef = db().doc(`chats/${chatId}`);
    const chatSnap = await chatRef.get();
    if (!chatSnap.exists || chatSnap.get('type') !== 'group') {
      throw new Error('El grupo ya no existe.');
    }
    if (chatSnap.get('createdBy') !== uid) {
      throw new Error('Solo el creador puede eliminar el grupo.');
    }

    const members = memberIdsOf(chatSnap.data() || {});
    const batch = db().batch();
    for (const memberId of members) {
      batch.delete(db().doc(`users/${memberId}/chatIndex/${chatId}`));
      batch.delete(chatRef.collection('members').doc(memberId));
    }
    batch.delete(chatRef);
    await batch.commit();
    res.json({ deleted: true });
  } catch (e: any) {
    res.status(400).json({ message: publicErrorMessage(e, 'Error al eliminar el grupo') });
  }
});
export default router;
