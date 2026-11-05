import { Router } from 'express';
import { publicErrorMessage } from '../lib/public-error';
import { db } from '../lib/firebase-admin';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import { FieldValue } from 'firebase-admin/firestore';

const router = Router();

const MAX_DISPLAY_NAME = 60;
const MAX_BIO = 280;

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'soporte',
  'support',
  'sismoconnect',
  'system',
  'sistema',
  'moderator',
  'moderador',
  'root',
  'firebase',
  'usgs',
]);

function cleanString(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

router.post('/bootstrap', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const now = Date.now();
    const userRef = db().doc(`users/${uid}`);
    const publicRef = db().doc(`publicProfiles/${uid}`);

    const displayName = req.user?.name?.trim()
      ? req.user.name.trim().slice(0, MAX_DISPLAY_NAME)
      : 'Explorador sísmico';
    const photoURL = req.user?.picture?.trim() || null;

    await db().runTransaction(async (tx) => {
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
  } catch (e: any) {
    console.error('BOOTSTRAP_FATAL', e);
    res.status(500).json({ message: publicErrorMessage(e, 'Error interno al inicializar el perfil') });
  }
});

router.post('/updateProfile', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const data = req.body || {};
    const displayName = cleanString(data.displayName, MAX_DISPLAY_NAME) || 'Explorador sísmico';
    const bio = cleanString(data.bio, MAX_BIO);
    const countryCode =
      typeof data.countryCode === 'string' && /^[A-Za-z]{2}$/.test(data.countryCode)
        ? data.countryCode.toUpperCase()
        : null;
    const language =
      typeof data.language === 'string' && /^[a-z]{2,10}$/i.test(data.language)
        ? data.language.toLowerCase()
        : 'es';
    const isPublic = data.isPublic !== false;
    const notificationsEnabled = data.notificationsEnabled === true;

    function optionalUrl(value: unknown): string | null {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value !== 'string' || !/^https:\/\//i.test(value)) {
        throw new Error('La imagen debe ser una URL HTTPS.');
      }
      return value.slice(0, 2048);
    }

    const photoURL = optionalUrl(data.photoURL);
    const coverURL = optionalUrl(data.coverURL);
    const now = Date.now();
    const userRef = db().doc(`users/${uid}`);
    const publicRef = db().doc(`publicProfiles/${uid}`);

    const result = await db().runTransaction(async (tx) => {
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
      } else {
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
  } catch (e: any) {
    res.status(400).json({ message: publicErrorMessage(e, 'Error al actualizar perfil') });
  }
});

router.post('/claimUsername', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const { username } = req.body || {};
    const normalized = typeof username === 'string' ? username.trim().toLowerCase() : '';

    if (!USERNAME_REGEX.test(normalized)) {
      return res.status(400).json({
        message: 'El usuario debe tener entre 3 y 20 caracteres: letras minúsculas, números o guion bajo.',
      });
    }

    if (RESERVED_USERNAMES.has(normalized)) {
      return res.status(409).json({ message: 'Ese nombre de usuario está reservado.' });
    }

    await db().runTransaction(async (tx) => {
      const userRef = db().doc(`users/${uid}`);
      const publicRef = db().doc(`publicProfiles/${uid}`);
      const usernameRef = db().doc(`usernames/${normalized}`);

      const [userSnap, publicSnap, usernameSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(publicRef),
        tx.get(usernameRef),
      ]);

      if (!userSnap.exists) {
        throw new Error('Usuario no encontrado.');
      }

      if (usernameSnap.exists) {
        const existingUid = usernameSnap.get('uid');
        if (existingUid && existingUid !== uid) {
          throw new Error('Ese nombre de usuario ya está en uso.');
        }
      }

      const previousUsername = userSnap.get('username');

      if (previousUsername && previousUsername !== normalized) {
        const prevRef = db().doc(`usernames/${previousUsername}`);
        const prevSnap = await tx.get(prevRef);
        if (prevSnap.exists && prevSnap.get('uid') === uid) {
          tx.delete(prevRef);
        }
      }

      tx.set(usernameRef, { uid, username: normalized, createdAt: Date.now() });
      tx.set(userRef, { username: normalized, updatedAt: Date.now() }, { merge: true });
      if (publicSnap.exists) {
        tx.set(publicRef, { username: normalized, updatedAt: Date.now() }, { merge: true });
      }
    });

    res.json({ username: normalized });
  } catch (e: any) {
    const message = publicErrorMessage(e, 'Error al reclamar nombre de usuario');
    if (/ya está en uso|reservado/.test(message)) {
      return res.status(409).json({ message });
    }
    if (/Usuario no encontrado|debe tener/.test(message)) {
      return res.status(400).json({ message });
    }
    res.status(400).json({ message });
  }
});

const NOTIFICATION_KEYS = ['earthquakes', 'social', 'messages', 'friends', 'groups'] as const;
type NotificationPrefs = Record<(typeof NOTIFICATION_KEYS)[number], boolean>;

function normalizeUsernameValue(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function prefsFrom(value: unknown): NotificationPrefs {
  const data = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    earthquakes: data.earthquakes !== false,
    social: data.social !== false,
    messages: data.messages !== false,
    friends: data.friends !== false,
    groups: data.groups !== false,
  };
}

function partialPrefs(value: unknown): Partial<NotificationPrefs> {
  const data = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const next: Partial<NotificationPrefs> = {};
  for (const key of NOTIFICATION_KEYS) {
    if (typeof data[key] === 'boolean') next[key] = data[key] as boolean;
  }
  return next;
}

router.post('/deleteUsername', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const userRef = db().doc(`users/${uid}`);
    const result = await db().runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) return { username: null };
      const username = normalizeUsernameValue(userSnap.get('username'));
      if (username) tx.delete(db().doc(`usernames/${username}`));
      const now = Date.now();
      tx.set(userRef, { username: null, updatedAt: now }, { merge: true });
      tx.set(
        db().doc(`publicProfiles/${uid}`),
        { username: null, updatedAt: now, removedAt: FieldValue.delete() },
        { merge: true }
      );
      return { username: null };
    });
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ message: publicErrorMessage(e, 'Error al eliminar nombre de usuario') });
  }
});

router.post('/updateNotificationPrefs', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const uid = req.user!.uid;
    const userRef = db().doc(`users/${uid}`);
    const now = Date.now();
    const result = await db().runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new Error('Completa tu perfil antes de editar las notificaciones.');
      }
      const next = { ...prefsFrom(userSnap.get('notificationPrefs')), ...partialPrefs(req.body) };
      tx.set(userRef, { notificationPrefs: next, updatedAt: now }, { merge: true });
      return next;
    });
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ message: publicErrorMessage(e, 'Error al actualizar notificaciones') });
  }
});
export default router;
