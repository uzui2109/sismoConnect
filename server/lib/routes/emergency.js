"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_admin_1 = require("../lib/firebase-admin");
const chat_config_1 = require("../lib/chat-config");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.post('/', auth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const chatId = typeof req.body?.chatId === 'string' ? req.body.chatId : '';
        if (!/^[A-Za-z0-9_-]{1,200}$/.test(chatId)) {
            return res.status(400).json({ message: 'Chat inválido.' });
        }
        const [userSnap, configSnap] = await Promise.all([
            (0, firebase_admin_1.db)().doc(`users/${uid}`).get(),
            (0, firebase_admin_1.db)().doc('config/chat').get(),
        ]);
        const lastEmergencyAt = (0, chat_config_1.toMillis)(userSnap.get('lastEmergencyAt'));
        const seconds = (0, chat_config_1.positiveSeconds)(configSnap.get('emergencyCooldownSeconds'), chat_config_1.EMERGENCY_COOLDOWN_SECONDS);
        return res.json({
            success: true,
            lastEmergencyAt,
            nextAllowedAt: lastEmergencyAt + seconds * 1000,
        });
    }
    catch (e) {
        console.error('[emergencyState] error:', e?.message);
        return res.status(500).json({
            message: e?.message || 'Error al consultar el estado de emergencia',
        });
    }
});
exports.default = router;
