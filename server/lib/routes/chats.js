"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const firebase_admin_1 = require("../lib/firebase-admin");
const auth_1 = require("../middleware/auth");
const firestore_1 = require("firebase-admin/firestore");
const crypto_1 = require("crypto");
const chat_config_1 = require("../lib/chat-config");
const router = (0, express_1.Router)();
const MAX_GROUP_TITLE = 60;
const MAX_GROUP_DESCRIPTION = 200;
const MAX_MESSAGE_LENGTH = 500;
const GLOBAL_CHAT_ID = 'global_sala_comunitaria';
function pairId(a, b) {
    return [a, b].sort().join('_');
}
function memberIdsOf(chat) {
    return Array.isArray(chat.memberIds)
        ? chat.memberIds.filter((value) => typeof value === 'string')
        : [];
}
function validateChatId(value) {
    const chatId = typeof value === 'string' ? value : '';
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(chatId)) {
        throw new Error('Chat inválido.');
    }
    return chatId;
}
router.post('/joinGlobalChat', auth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const chatRef = (0, firebase_admin_1.db)().doc(`chats/${GLOBAL_CHAT_ID}`);
        const memberRef = chatRef.collection('members').doc(uid);
        const indexRef = (0, firebase_admin_1.db)().doc(`users/${uid}/chatIndex/${GLOBAL_CHAT_ID}`);
        const now = Date.now();
        await (0, firebase_admin_1.db)().runTransaction(async (tx) => {
            const [chatSnap, memberSnap] = await Promise.all([tx.get(chatRef), tx.get(memberRef)]);
            if (!chatSnap.exists) {
                tx.set(chatRef, {
                    type: 'group',
                    title: 'Sala Comunitaria',
                    description: 'Lugar abierto para hablar con toda la comunidad.',
                    photoURL: null,
                    memberIds: [],
                    inviteCode: null,
                    createdBy: 'system',
                    createdAt: now,
                    updatedAt: now,
                    lastMessageText: '',
                    lastMessageSenderId: null,
                    lastMessageAt: 0,
                });
            }
            if (!memberSnap.exists) {
                tx.set(memberRef, { uid, role: 'member', joinedAt: now, lastReadAt: now });
            }
            const chat = chatSnap.exists ? chatSnap.data() || {} : {};
            tx.set(indexRef, {
                chatId: GLOBAL_CHAT_ID,
                type: 'group',
                title: chat.title ?? 'Sala Comunitaria',
                photoURL: chat.photoURL ?? null,
                lastMessageText: chat.lastMessageText ?? '',
                lastMessageSenderId: chat.lastMessageSenderId ?? null,
                lastMessageAt: chat.lastMessageAt ?? 0,
                unreadCount: 0,
                updatedAt: now,
            }, { merge: true });
        });
        res.json({ chatId: GLOBAL_CHAT_ID });
    }
    catch (e) {
        res.status(400).json({ message: e?.message || 'Error al abrir la sala global' });
    }
});
router.post('/createDirectChat', auth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const otherUid = typeof req.body?.uid === 'string' ? req.body.uid : '';
        if (!otherUid || otherUid === uid)
            throw new Error('Usuario inválido.');
        const pair = pairId(uid, otherUid);
        const chatId = `direct_${pair}`;
        const chatRef = (0, firebase_admin_1.db)().doc(`chats/${chatId}`);
        const otherProfileRef = (0, firebase_admin_1.db)().doc(`publicProfiles/${otherUid}`);
        const friendshipRef = (0, firebase_admin_1.db)().doc(`friendships/${pair}`);
        const now = Date.now();
        const result = await (0, firebase_admin_1.db)().runTransaction(async (tx) => {
            const [chatSnap, friendshipSnap, blockAB, blockBA, profileSnap] = await Promise.all([
                tx.get(chatRef),
                tx.get(friendshipRef),
                tx.get((0, firebase_admin_1.db)().doc(`blocks/${uid}_${otherUid}`)),
                tx.get((0, firebase_admin_1.db)().doc(`blocks/${otherUid}_${uid}`)),
                tx.get(otherProfileRef),
            ]);
            if (blockAB.exists || blockBA.exists)
                throw new Error('No puedes abrir este chat.');
            if (!friendshipSnap.exists)
                throw new Error('Primero deben ser amistades.');
            if (chatSnap.exists)
                return { chatId };
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
                tx.set((0, firebase_admin_1.db)().doc(`users/${memberId}/chatIndex/${chatId}`), {
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
    }
    catch (e) {
        res.status(400).json({ message: e?.message || 'Error al crear chat' });
    }
});
router.post('/createGroup', auth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
        if (title.length < 2 || title.length > MAX_GROUP_TITLE) {
            throw new Error(`El nombre del grupo debe tener entre 2 y ${MAX_GROUP_TITLE} caracteres.`);
        }
        const chatRef = (0, firebase_admin_1.db)().collection('chats').doc();
        const chatId = chatRef.id;
        const inviteCode = (0, crypto_1.randomBytes)(5).toString('hex').toUpperCase();
        const now = Date.now();
        await (0, firebase_admin_1.db)().runTransaction(async (tx) => {
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
            tx.set((0, firebase_admin_1.db)().doc(`users/${uid}/chatIndex/${chatId}`), {
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
    }
    catch (e) {
        res.status(400).json({ message: e?.message || 'Error al crear grupo' });
    }
});
router.post('/joinGroupByCode', auth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const inviteCode = typeof req.body?.inviteCode === 'string' ? req.body.inviteCode.trim().toUpperCase() : '';
        if (!/^[A-Z0-9]{4,16}$/.test(inviteCode))
            throw new Error('Código de invitación inválido.');
        const matches = await (0, firebase_admin_1.db)().collection('chats').where('inviteCode', '==', inviteCode).limit(1).get();
        if (matches.empty)
            throw new Error('No encontramos ese grupo.');
        const chatRef = matches.docs[0].ref;
        const chatId = chatRef.id;
        const memberRef = chatRef.collection('members').doc(uid);
        const now = Date.now();
        await (0, firebase_admin_1.db)().runTransaction(async (tx) => {
            const [chatSnap, memberSnap] = await Promise.all([tx.get(chatRef), tx.get(memberRef)]);
            if (!chatSnap.exists || chatSnap.get('type') !== 'group')
                throw new Error('No encontramos ese grupo.');
            if (memberSnap.exists)
                return;
            const chat = chatSnap.data() || {};
            const members = memberIdsOf(chat);
            if (members.length >= 50)
                throw new Error('El grupo alcanzó el límite de miembros.');
            tx.set(chatRef, { memberIds: [...members, uid].sort(), updatedAt: now }, { merge: true });
            tx.set(memberRef, { uid, role: 'member', joinedAt: now, lastReadAt: now });
            tx.set((0, firebase_admin_1.db)().doc(`users/${uid}/chatIndex/${chatId}`), {
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
    }
    catch (e) {
        res.status(400).json({ message: e?.message || 'Error al unirse al grupo' });
    }
});
router.post('/sendMessage', auth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const data = req.body || {};
        const chatId = validateChatId(data.chatId);
        const text = typeof data.text === 'string' ? data.text.trim() : '';
        const emergency = data.emergency === true;
        if (!text)
            throw new Error('El mensaje está vacío.');
        if (text.length > MAX_MESSAGE_LENGTH)
            throw new Error(`El mensaje supera los ${MAX_MESSAGE_LENGTH} caracteres.`);
        const chatRef = (0, firebase_admin_1.db)().doc(`chats/${chatId}`);
        const memberRef = chatRef.collection('members').doc(uid);
        const userRef = (0, firebase_admin_1.db)().doc(`users/${uid}`);
        const configRef = (0, firebase_admin_1.db)().doc('config/chat');
        const messageRef = chatRef.collection('messages').doc();
        const now = Date.now();
        const result = await (0, firebase_admin_1.db)().runTransaction(async (tx) => {
            const [chatSnap, memberSnap, userSnap, configSnap] = await Promise.all([
                tx.get(chatRef),
                tx.get(memberRef),
                tx.get(userRef),
                tx.get(configRef),
            ]);
            if (!chatSnap.exists)
                throw new Error('El chat no existe.');
            if (!memberSnap.exists && chatId !== 'global_sala_comunitaria') {
                throw new Error('No perteneces a este chat.');
            }
            const lastMessageAt = (0, chat_config_1.toMillis)(userSnap.get('lastMessageAt'));
            const lastEmergencyAt = (0, chat_config_1.toMillis)(userSnap.get('lastEmergencyAt'));
            const cooldownMs = (0, chat_config_1.positiveSeconds)(configSnap.get('cooldownSeconds'), chat_config_1.COOLDOWN_SECONDS) * 1000;
            const emergencyCooldownMs = (0, chat_config_1.positiveSeconds)(configSnap.get('emergencyCooldownSeconds'), chat_config_1.EMERGENCY_COOLDOWN_SECONDS) *
                1000;
            if (emergency) {
                if (lastEmergencyAt && now - lastEmergencyAt < emergencyCooldownMs) {
                    return {
                        ok: false,
                        message: 'La alerta de emergencia ya fue usada. Puedes volver a usarla en unos minutos.',
                        nextAllowedAt: lastEmergencyAt + emergencyCooldownMs,
                    };
                }
            }
            else if (lastMessageAt && now - lastMessageAt < cooldownMs) {
                return {
                    ok: false,
                    message: `Espera ${Math.ceil((cooldownMs - (now - lastMessageAt)) / 1000)} s para volver a enviar.`,
                    nextAllowedAt: lastMessageAt + cooldownMs,
                };
            }
            if (!memberSnap.exists && chatId === 'global_sala_comunitaria') {
                tx.set(memberRef, { uid, role: 'member', joinedAt: now, lastReadAt: now });
                tx.set((0, firebase_admin_1.db)().doc(`users/${uid}/chatIndex/${chatId}`), {
                    chatId,
                    type: 'group',
                    title: 'Sala Comunitaria',
                    photoURL: null,
                    lastMessageText: '',
                    lastMessageSenderId: null,
                    lastMessageAt: 0,
                    unreadCount: 0,
                    updatedAt: now,
                }, { merge: true });
            }
            const chat = chatSnap.data() || {};
            const chatMembers = memberIdsOf(chat);
            tx.set(messageRef, { senderId: uid, text, emergency, clientId: data.clientId || null, createdAt: firestore_1.FieldValue.serverTimestamp() });
            tx.set(chatRef, { lastMessageText: text.slice(0, 140), lastMessageAt: firestore_1.FieldValue.serverTimestamp(), lastMessageSenderId: uid, updatedAt: now }, { merge: true });
            tx.set(memberRef, { lastReadAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
            tx.set(userRef, {
                lastMessageAt: now,
                lastEmergencyAt: emergency ? now : lastEmergencyAt || null,
                updatedAt: now,
            }, { merge: true });
            if (chatMembers.length > 0) {
                for (const memberId of chatMembers) {
                    const indexRef = (0, firebase_admin_1.db)().doc(`users/${memberId}/chatIndex/${chatId}`);
                    tx.set(indexRef, {
                        chatId,
                        type: chat.type ?? 'group',
                        title: chat.title ?? 'Sala Comunitaria',
                        photoURL: chat.photoURL ?? null,
                        lastMessageText: text.slice(0, 140),
                        lastMessageAt: firestore_1.FieldValue.serverTimestamp(),
                        lastMessageSenderId: uid,
                        unreadCount: memberId === uid ? 0 : firestore_1.FieldValue.increment(1),
                        updatedAt: now,
                    }, { merge: true });
                }
            }
            return {
                ok: true,
                messageId: messageRef.id,
                usedUnlock: false,
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
    }
    catch (e) {
        res.status(400).json({ message: e?.message || 'Error al enviar mensaje' });
    }
});
router.post('/markChatRead', auth_1.requireAuth, async (req, res) => {
    try {
        const uid = req.user.uid;
        const chatId = validateChatId(req.body?.chatId);
        const memberRef = (0, firebase_admin_1.db)().doc(`chats/${chatId}/members/${uid}`);
        const indexRef = (0, firebase_admin_1.db)().doc(`users/${uid}/chatIndex/${chatId}`);
        await (0, firebase_admin_1.db)().runTransaction(async (tx) => {
            const memberSnap = await tx.get(memberRef);
            if (!memberSnap.exists)
                throw new Error('No perteneces a este chat.');
            tx.set(memberRef, { lastReadAt: firestore_1.FieldValue.serverTimestamp() }, { merge: true });
            tx.set(indexRef, { unreadCount: 0, updatedAt: Date.now() }, { merge: true });
        });
        res.json({ read: true });
    }
    catch (e) {
        res.status(400).json({ message: e?.message || 'Error al marcar como leído' });
    }
});
exports.default = router;
