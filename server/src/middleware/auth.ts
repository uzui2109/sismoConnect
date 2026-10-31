import { Request, Response, NextFunction } from 'express';
import { auth } from '../lib/firebase-admin';

export interface AuthedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    const decoded = await auth().verifyIdToken(token);
    req.user = { uid: decoded.uid, email: decoded.email };
    next();
  } catch (e: any) {
    console.error('[requireAuth] verifyIdToken error:', e?.message);
    return res.status(401).json({ message: 'Token inválido' });
  }
}
