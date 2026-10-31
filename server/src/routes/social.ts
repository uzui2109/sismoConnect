import { Router } from 'express';
import { db } from '../lib/firebase-admin';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

function pairId(a: string, b: string) {
  return [a, b].sort().join('_');
}

function readId(data: any): string {
  const value = data?.uid;
  if (typeof value !== 'string' || value.length < 1 || value.length > 128) {
    throw new Error('Usuario inválido.');
  }
  return value;
}

router.post('/sendFriendRequest', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const toUid = readId(req.body);
    if (toUid === uid) throw new Error('No puedes agregarte a ti mismo.');

    const now = Date.now();
    const requestId = `request_${pairId(uid, toUid)}`;
    const requestRef = db().doc(`friendRequests/${requestId}`);
    const friendshipRef = db().doc(`friendships/${pairId(uid, toUid)}`);
    const targetRef = db().doc(`users/${toUid}`);
    const blockAB = db().doc(`blocks/${uid}_${toUid}`);
    const blockBA = db().doc(`blocks/${toUid}_${uid}`);

    const result = await db().runTransaction(async (tx) => {
      const [targetSnap, friendshipSnap, requestSnap, blockABSnap, blockBASnap] = await Promise.all([
        tx.get(targetRef),
        tx.get(friendshipRef),
        tx.get(requestRef),
        tx.get(blockAB),
        tx.get(blockBA),
      ]);

      if (!targetSnap.exists) throw new Error('Ese perfil no existe.');
      if (targetSnap.get('suspended') === true) throw new Error('Ese usuario no está disponible.');
      if (blockABSnap.exists || blockBASnap.exists) throw new Error('No puedes enviar una solicitud a este usuario.');
      if (friendshipSnap.exists) return { requestId, status: 'accepted' as const };

      if (requestSnap.exists && requestSnap.get('status') === 'pending') {
        const fromUid = requestSnap.get('fromUid');
        if (fromUid === uid) return { requestId, status: 'pending' as const };
        tx.set(friendshipRef, { memberIds: [uid, toUid].sort(), createdAt: now, updatedAt: now });
        tx.set(requestRef, { status: 'accepted', respondedAt: now, updatedAt: now }, { merge: true });
        return { requestId, status: 'accepted' as const };
      }

      tx.set(requestRef, { fromUid: uid, toUid, status: 'pending', createdAt: now, updatedAt: now });
      return { requestId, status: 'pending' as const };
    });

    res.json(result);
  } catch (e: any) {
    res.status(400).json({ message: e?.message || 'Error al enviar solicitud' });
  }
});

router.post('/respondFriendRequest', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const data = req.body || {};
    const requestId = typeof data.requestId === 'string' ? data.requestId : '';
    const accept = data.accept === true;
    if (!requestId) throw new Error('Solicitud inválida.');

    const requestRef = db().doc(`friendRequests/${requestId}`);
    const now = Date.now();

    const result = await db().runTransaction(async (tx) => {
      const requestSnap = await tx.get(requestRef);
      if (!requestSnap.exists) throw new Error('La solicitud no existe.');
      if (requestSnap.get('toUid') !== uid) throw new Error('Esta solicitud no es para ti.');
      if (requestSnap.get('status') !== 'pending') throw new Error('La solicitud ya fue respondida.');

      const fromUid = String(requestSnap.get('fromUid'));
      if (accept) {
        tx.set(db().doc(`friendships/${pairId(uid, fromUid)}`), {
          memberIds: [uid, fromUid].sort(),
          createdAt: now,
          updatedAt: now,
        });
      }

      tx.set(requestRef, { status: accept ? 'accepted' : 'declined', respondedAt: now, updatedAt: now }, { merge: true });
      return { status: accept ? 'accepted' : 'declined' };
    });

    res.json(result);
  } catch (e: any) {
    res.status(400).json({ message: e?.message || 'Error al responder solicitud' });
  }
});

router.post('/removeFriend', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const otherUid = readId(req.body);
    if (otherUid === uid) throw new Error('Usuario inválido.');

    const now = Date.now();
    const friendshipId = pairId(uid, otherUid);
    const requestId = `request_${friendshipId}`;
    const friendshipRef = db().doc(`friendships/${friendshipId}`);
    const requestRef = db().doc(`friendRequests/${requestId}`);

    await db().runTransaction(async (tx) => {
      const [friendshipSnap, requestSnap] = await Promise.all([tx.get(friendshipRef), tx.get(requestRef)]);
      if (friendshipSnap.exists && !(friendshipSnap.get('memberIds') ?? []).includes(uid)) {
        throw new Error('No perteneces a esta amistad.');
      }
      tx.delete(friendshipRef);
      if (requestSnap.exists) {
        tx.set(requestRef, { status: 'removed', updatedAt: now }, { merge: true });
      }
    });

    res.json({ removed: true });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || 'Error al eliminar amistad' });
  }
});

router.post('/blockUser', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const otherUid = readId(req.body);
    if (otherUid === uid) throw new Error('No puedes bloquearte a ti mismo.');

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

    res.json({ blocked: true });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || 'Error al bloquear' });
  }
});

router.post('/unblockUser', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const otherUid = readId(req.body);
    await db().doc(`blocks/${uid}_${otherUid}`).delete();
    res.json({ blocked: false });
  } catch (e: any) {
    res.status(400).json({ message: e?.message || 'Error al desbloquear' });
  }
});

export default router;
