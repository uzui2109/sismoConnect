import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { CALL_OPTIONS, db, isRecord, pairId } from './config';

function requiredUid(request: { auth?: { uid?: string } }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  return uid;
}

function readId(data: unknown): string {
  const value = isRecord(data) ? data.uid : null;
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) {
    throw new HttpsError('invalid-argument', 'Usuario inválido.');
  }
  return value;
}

export const sendFriendRequest = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const toUid = readId(request.data);
  if (toUid === uid) throw new HttpsError('invalid-argument', 'No puedes agregarte a ti mismo.');

  const now = Date.now();
  const requestId = `request_${pairId(uid, toUid)}`;
  const requestRef = db().doc(`friendRequests/${requestId}`);
  const friendshipRef = db().doc(`friendships/${pairId(uid, toUid)}`);
  const targetRef = db().doc(`users/${toUid}`);
  const blockAB = db().doc(`blocks/${uid}_${toUid}`);
  const blockBA = db().doc(`blocks/${toUid}_${uid}`);

  return db().runTransaction(async (tx) => {
    const [targetSnap, friendshipSnap, requestSnap, blockABSnap, blockBASnap] = await Promise.all([
      tx.get(targetRef),
      tx.get(friendshipRef),
      tx.get(requestRef),
      tx.get(blockAB),
      tx.get(blockBA),
    ]);

    if (!targetSnap.exists) throw new HttpsError('not-found', 'Ese perfil no existe.');
    if (targetSnap.get('suspended') === true) {
      throw new HttpsError('permission-denied', 'Ese usuario no está disponible.');
    }
    if (blockABSnap.exists || blockBASnap.exists) {
      throw new HttpsError('permission-denied', 'No puedes enviar una solicitud a este usuario.');
    }
    if (friendshipSnap.exists) return { requestId, status: 'accepted' as const };

    if (requestSnap.exists && requestSnap.get('status') === 'pending') {
      const fromUid = requestSnap.get('fromUid');
      if (fromUid === uid) return { requestId, status: 'pending' as const };

      // Both people tapped "add": turn the pending request into a friendship.
      tx.set(friendshipRef, {
        memberIds: [uid, toUid].sort(),
        createdAt: now,
        updatedAt: now,
      });
      tx.set(requestRef, { status: 'accepted', respondedAt: now, updatedAt: now }, { merge: true });
      return { requestId, status: 'accepted' as const };
    }

    tx.set(requestRef, {
      fromUid: uid,
      toUid,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    return { requestId, status: 'pending' as const };
  });
});

export const respondFriendRequest = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const requestId = typeof data.requestId === 'string' ? data.requestId : '';
  const accept = data.accept === true;
  if (!requestId) throw new HttpsError('invalid-argument', 'Solicitud inválida.');

  const requestRef = db().doc(`friendRequests/${requestId}`);
  const now = Date.now();

  return db().runTransaction(async (tx) => {
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists) throw new HttpsError('not-found', 'La solicitud no existe.');
    if (requestSnap.get('toUid') !== uid) {
      throw new HttpsError('permission-denied', 'Esta solicitud no es para ti.');
    }
    if (requestSnap.get('status') !== 'pending') {
      throw new HttpsError('failed-precondition', 'La solicitud ya fue respondida.');
    }

    const fromUid = String(requestSnap.get('fromUid'));
    if (accept) {
      tx.set(db().doc(`friendships/${pairId(uid, fromUid)}`), {
        memberIds: [uid, fromUid].sort(),
        createdAt: now,
        updatedAt: now,
      });
    }

    tx.set(
      requestRef,
      {
        status: accept ? 'accepted' : 'declined',
        respondedAt: now,
        updatedAt: now,
      },
      { merge: true }
    );

    return { status: accept ? 'accepted' : 'declined' };
  });
});

export const removeFriend = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const otherUid = readId(request.data);
  if (otherUid === uid) throw new HttpsError('invalid-argument', 'Usuario inválido.');

  const now = Date.now();
  const friendshipId = pairId(uid, otherUid);
  const requestId = `request_${friendshipId}`;
  const friendshipRef = db().doc(`friendships/${friendshipId}`);
  const requestRef = db().doc(`friendRequests/${requestId}`);

  await db().runTransaction(async (tx) => {
    const [friendshipSnap, requestSnap] = await Promise.all([
      tx.get(friendshipRef),
      tx.get(requestRef),
    ]);
    if (friendshipSnap.exists && !(friendshipSnap.get('memberIds') ?? []).includes(uid)) {
      throw new HttpsError('permission-denied', 'No perteneces a esta amistad.');
    }
    tx.delete(friendshipRef);
    if (requestSnap.exists) {
      tx.set(requestRef, { status: 'removed', updatedAt: now }, { merge: true });
    }
  });

  return { removed: true };
});

export const blockUser = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const otherUid = readId(request.data);
  if (otherUid === uid) throw new HttpsError('invalid-argument', 'No puedes bloquearte a ti mismo.');

  const now = Date.now();
  const blockRef = db().doc(`blocks/${uid}_${otherUid}`);
  const friendshipId = pairId(uid, otherUid);
  const friendshipRef = db().doc(`friendships/${friendshipId}`);
  const requestRef = db().doc(`friendRequests/request_${friendshipId}`);

  await db().runTransaction(async (tx) => {
    tx.set(blockRef, { blockerUid: uid, blockedUid: otherUid, createdAt: now });
    tx.delete(friendshipRef);
    tx.set(requestRef, { status: 'blocked', updatedAt: now }, { merge: true });
  });

  return { blocked: true };
});

export const unblockUser = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const otherUid = readId(request.data);
  await db().doc(`blocks/${uid}_${otherUid}`).delete();
  return { blocked: false };
});

export const reportUser = onCall(CALL_OPTIONS, async (request) => {
  const uid = requiredUid(request);
  const data = isRecord(request.data) ? request.data : {};
  const reportedUid = readId(data);
  if (reportedUid === uid) throw new HttpsError('invalid-argument', 'No puedes reportarte.');

  const allowed = new Set(['spam', 'abuso', 'acoso', 'contenido', 'otro']);
  const reason = typeof data.reason === 'string' && allowed.has(data.reason) ? data.reason : 'otro';
  const details =
    typeof data.details === 'string' ? data.details.trim().slice(0, 500) : '';

  const ref = db().collection('reports').doc();
  await ref.set({
    reporterUid: uid,
    reportedUid,
    reason,
    details,
    status: 'open',
    createdAt: Date.now(),
  });

  return { reportId: ref.id };
});
