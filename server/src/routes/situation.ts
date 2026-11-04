import { Router } from 'express';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import { getSituationReports } from '../lib/situation';

const router = Router();

router.post('/reports', requireAuth, async (_req: AuthedRequest, res) => {
  try {
    const feed = await getSituationReports();
    res.json(feed);
  } catch (e: any) {
    const message = e?.message || 'Error interno al obtener informes';
    if (/no respondieron|no pudieron|cache/i.test(message)) {
      if (e?.sourceErrors) {
        console.error('[situation] fuentes oficiales con error:', e.sourceErrors);
      }
      return res.status(503).json({ message });
    }
    res.status(500).json({ message });
  }
});

export default router;
