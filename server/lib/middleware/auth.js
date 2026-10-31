"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
const firebase_admin_1 = require("../lib/firebase-admin");
async function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : '';
        if (!token) {
            return res.status(401).json({ message: 'No autenticado' });
        }
        const decoded = await (0, firebase_admin_1.auth)().verifyIdToken(token);
        req.user = { uid: decoded.uid, email: decoded.email };
        next();
    }
    catch (e) {
        console.error('[requireAuth] verifyIdToken error:', e?.message);
        return res.status(401).json({ message: 'Token inválido' });
    }
}
