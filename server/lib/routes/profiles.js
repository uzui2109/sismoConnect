"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_admin_1 = require("../lib/firebase-admin");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const MAX_DISPLAY_NAME = 40;
const MAX_BIO = 160;
function cleanString(value, max) {
    if (typeof value !== 'string')
        return '';
    return value.trim().slice(0, max);
}
router.post('/bootstrap', auth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const now = Date.now();
        const userRef = (0, firebase_admin_1.db)().doc(`users/${uid}`);
        const publicRef = (0, firebase_admin_1.db)().doc(`publicProfiles/${uid}`);
        const token = {};
        const displayName = typeof token.name === 'string' && token.name.trim()
            ? token.name.trim().slice(0, MAX_DISPLAY_NAME)
            : 'Explorador sísmico';
        const photoURL = typeof token.picture === 'string' && token.picture.trim() ? token.picture.trim() : null;
        await (0, firebase_admin_1.db)().runTransaction(async (tx) => {
            const [userSnap, publicSnap] = await Promise.all([tx.get(userRef), tx.get(publicRef)]);
            if (!userSnap.exists) {
                tx.set(userRef, {
                    uid,
                    displayName,
                    username: null,
                    bio: '',
                    photoURL,
                    coverURL: null,
                    countryCode: null,
                    language: 'es',
                    isPublic: true,
                    notificationsEnabled: false,
                    notificationPrefs: {
                        earthquakes: true,
                        social: true,
                        messages: true,
                        friends: true,
                        groups: true,
                    },
                    unlocks: 0,
                    lastMessageAt: 0,
                    lastEmergencyAt: 0,
                    createdAt: now,
                    updatedAt: now,
                });
            }
            if (!publicSnap.exists) {
                tx.set(publicRef, {
                    uid,
                    displayName,
                    username: null,
                    bio: '',
                    photoURL,
                    coverURL: null,
                    countryCode: null,
                    isPublic: true,
                    createdAt: now,
                    updatedAt: now,
                });
            }
        });
        const userSnap = await userRef.get();
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        res.json({
            uid,
            displayName: userData.displayName ?? displayName,
            username: userData.username ?? null,
            bio: userData.bio ?? '',
            photoURL: userData.photoURL ?? photoURL,
            coverURL: userData.coverURL ?? null,
            countryCode: userData.countryCode ?? null,
            language: userData.language ?? 'es',
            isPublic: userData.isPublic ?? true,
            notificationsEnabled: userData.notificationsEnabled ?? false,
            notificationPrefs: userData.notificationPrefs ?? {
                earthquakes: true,
                social: true,
                messages: true,
                friends: true,
                groups: true,
            },
            unlocks: userData.unlocks ?? 0,
            lastMessageAt: userData.lastMessageAt ?? 0,
            lastEmergencyAt: userData.lastEmergencyAt ?? 0,
            createdAt: userData.createdAt ?? now,
            updatedAt: userData.updatedAt ?? now,
        });
    }
    catch (e) {
        console.error('BOOTSTRAP_FATAL', e);
        res.status(500).json({ message: e?.message || 'Error interno al inicializar el perfil' });
    }
});
router.post('/updateProfile', auth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const data = req.body || {};
        const displayName = cleanString(data.displayName, MAX_DISPLAY_NAME) || 'Explorador sísmico';
        const bio = cleanString(data.bio, MAX_BIO);
        const countryCode = typeof data.countryCode === 'string' && /^[A-Za-z]{2}$/.test(data.countryCode)
            ? data.countryCode.toUpperCase()
            : null;
        const language = typeof data.language === 'string' && /^[a-z]{2,10}$/i.test(data.language)
            ? data.language.toLowerCase()
            : 'es';
        const isPublic = data.isPublic !== false;
        const notificationsEnabled = data.notificationsEnabled === true;
        function optionalUrl(value) {
            if (value === null || value === undefined || value === '')
                return null;
            if (typeof value !== 'string' || !/^https:\/\//i.test(value)) {
                throw new Error('La imagen debe ser una URL HTTPS.');
            }
            return value.slice(0, 2048);
        }
        const photoURL = optionalUrl(data.photoURL);
        const coverURL = optionalUrl(data.coverURL);
        const now = Date.now();
        const userRef = (0, firebase_admin_1.db)().doc(`users/${uid}`);
        const publicRef = (0, firebase_admin_1.db)().doc(`publicProfiles/${uid}`);
        const result = await (0, firebase_admin_1.db)().runTransaction(async (tx) => {
            const [userSnap, publicSnap] = await Promise.all([tx.get(userRef), tx.get(publicRef)]);
            if (!userSnap.exists) {
                throw new Error('Completa tu perfil antes de editarlo.');
            }
            const userPatch = {
                displayName,
                bio,
                countryCode,
                language,
                isPublic,
                notificationsEnabled,
                photoURL,
                coverURL,
                updatedAt: now,
            };
            const publicPatch = {
                uid,
                displayName,
                bio,
                countryCode,
                isPublic,
                photoURL,
                coverURL,
                updatedAt: now,
            };
            tx.set(userRef, userPatch, { merge: true });
            if (publicSnap.exists) {
                tx.set(publicRef, publicPatch, { merge: true });
            }
            else {
                tx.set(publicRef, { ...publicPatch, username: userSnap.get('username') ?? null, createdAt: now });
            }
            return {
                ...userPatch,
                username: userSnap.get('username') ?? null,
                notificationPrefs: userSnap.get('notificationPrefs') ?? {
                    earthquakes: true,
                    social: true,
                    messages: true,
                    friends: true,
                    groups: true,
                },
                unlocks: userSnap.get('unlocks') ?? 0,
                lastMessageAt: userSnap.get('lastMessageAt') ?? 0,
                lastEmergencyAt: userSnap.get('lastEmergencyAt') ?? 0,
                createdAt: userSnap.get('createdAt') ?? now,
            };
        });
        res.json(result);
    }
    catch (e) {
        res.status(400).json({ message: e?.message || 'Error al actualizar perfil' });
    }
});
exports.default = router;
