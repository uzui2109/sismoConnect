import { Router } from 'express';
import { publicErrorMessage } from '../lib/public-error';
import { db } from '../lib/firebase-admin';
import { AuthedRequest, requireAuth } from '../middleware/auth';

const router = Router();

const MAX_STORED_UNLOCKS = 1;

router.post('/state', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const userSnap = await db().doc(`users/${uid}`).get();
    if (!userSnap.exists) {
      return res.json({ unlocks: 0, lastMessageAt: 0, lastEmergencyAt: 0 });
    }
    return res.json({
      unlocks: Math.min(
        MAX_STORED_UNLOCKS,
        Math.max(0, Math.floor(Number(userSnap.get('unlocks')) || 0))
      ),
      lastMessageAt: Number(userSnap.get('lastMessageAt')) || 0,
      lastEmergencyAt: Number(userSnap.get('lastEmergencyAt')) || 0,
    });
  } catch (e: any) {
    res.status(500).json({ message: publicErrorMessage(e, 'Error al consultar recompensas') });
  }
});

export default router;