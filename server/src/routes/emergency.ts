import { Router } from 'express';
import { db } from '../lib/firebase-admin';
import { EMERGENCY_COOLDOWN_SECONDS, positiveSeconds, toMillis } from '../lib/chat-config';
import { AuthedRequest, requireAuth } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const chatId = typeof req.body?.chatId === 'string' ? req.body.chatId : '';
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(chatId)) {
      return res.status(400).json({ message: 'Chat inválido.' });
    }

    const [userSnap, configSnap] = await Promise.all([
      db().doc(`users/${uid}`).get(),
      db().doc('config/chat').get(),
    ]);

    const lastEmergencyAt = toMillis(userSnap.get('lastEmergencyAt'));
    const seconds = positiveSeconds(
      configSnap.get('emergencyCooldownSeconds'),
      EMERGENCY_COOLDOWN_SECONDS
    );

    return res.json({
      success: true,
      lastEmergencyAt,
      nextAllowedAt: lastEmergencyAt + seconds * 1000,
    });
  } catch (e: any) {
    console.error('[emergencyState] error:', e?.message);
    return res.status(500).json({
      message: e?.message || 'Error al consultar el estado de emergencia',
    });
  }
});

export default router;
