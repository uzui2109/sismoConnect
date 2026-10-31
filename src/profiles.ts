import { FieldValue } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import {
  CALL_OPTIONS,
  MAX_BIO,
  MAX_DISPLAY_NAME,
  RESERVED_USERNAMES,
  USERNAME_REGEX,
  db,
  isRecord,
  normalizeUsername,
} from './config';

function cleanString(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

export const bootstrapProfile = onCall(CALL_OPTIONS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');

  const now = Date.now();
  const userRef = db().doc(`users/${uid}`);
  const publicRef = db().doc(`publicProfiles/${uid}`);
  const token = (request.auth?.token ?? {}) as Record<string, unknown>;
  const displayName =
    typeof token.name === 'string' && token.name.trim()
      ? token.name.trim().slice(0, MAX_DISPLAY_NAME)
      : 'Explorador sísmico';
  const photoURL = typeof token.picture === 'string' ? token.picture : null;

  return db().runTransaction(async (tx) => {
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

    return {
      uid,
      displayName: userSnap.get('displayName') ?? displayName,
      username: userSnap.get('username') ?? null,
      bio: userSnap.get('bio') ?? '',
      photoURL: userSnap.get('photoURL') ?? photoURL,
      coverURL: userSnap.get('coverURL') ?? null,
      countryCode: userSnap.get('countryCode') ?? null,
      language: userSnap.get('language') ?? 'es',
      isPublic: userSnap.get('isPublic') ?? true,
      notificationsEnabled: userSnap.get('notificationsEnabled') ?? false,
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
      updatedAt: userSnap.get('updatedAt') ?? now,
    };
  });
});

export const claimUsername = onCall(CALL_OPTIONS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');

  const username = normalizeUsername(isRecord(request.data) ? request.data.username : null);
  if (!USERNAME_REGEX.test(username)) {
    throw new HttpsError(
      'invalid-argument',
      'El usuario debe tener entre 3 y 20 caracteres: letras minúsculas, números o guion bajo.'
    );
  }
  if (RESERVED_USERNAMES.has(username)) {
    throw new HttpsError('already-exists', 'Ese nombre de usuario está reservado.');
  }

  const now = Date.now();
  const userRef = db().doc(`users/${uid}`);
  const publicRef = db().doc(`publicProfiles/${uid}`);
  const usernameRef = db().doc(`usernames/${username}`);

  return db().runTransaction(async (tx) => {
    const [userSnap, usernameSnap, publicSnap] = await Promise.all([
      tx.get(userRef),
      tx.get(usernameRef),
      tx.get(publicRef),
    ]);

    if (!userSnap.exists) {
      throw new HttpsError('failed-precondition', 'Completa tu perfil antes de elegir un usuario.');
    }

    const previous = normalizeUsername(userSnap.get('username'));
    if (usernameSnap.exists && usernameSnap.get('uid') !== uid) {
      throw new HttpsError('already-exists', 'Ese nombre de usuario ya está en uso.');
    }

    if (previous && previous !== username) {
      tx.delete(db().doc(`usernames/${previous}`));
    }

    tx.set(usernameRef, { uid, username, createdAt: now }, { merge: true });
    tx.set(userRef, { username, updatedAt: now }, { merge: true });
    if (publicSnap.exists) {
      tx.set(publicRef, { username, updatedAt: now }, { merge: true });
    } else {
      tx.set(publicRef, {
        uid,
        username,
        displayName: userSnap.get('displayName') ?? 'Explorador sísmico',
        bio: userSnap.get('bio') ?? '',
        photoURL: userSnap.get('photoURL') ?? null,
        coverURL: null,
        countryCode: userSnap.get('countryCode') ?? null,
        isPublic: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    return { username };
  });
});

export const updateProfile = onCall(CALL_OPTIONS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');

  const data = isRecord(request.data) ? request.data : {};
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
      throw new HttpsError('invalid-argument', 'La imagen debe ser una URL HTTPS.');
    }
    return value.slice(0, 2048);
  }

  const photoURL = optionalUrl(data.photoURL);
  const coverURL = optionalUrl(data.coverURL);
  const now = Date.now();
  const userRef = db().doc(`users/${uid}`);
  const publicRef = db().doc(`publicProfiles/${uid}`);
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

  return db().runTransaction(async (tx) => {
    const [userSnap, publicSnap] = await Promise.all([tx.get(userRef), tx.get(publicRef)]);
    if (!userSnap.exists) {
      throw new HttpsError('failed-precondition', 'Completa tu perfil antes de editarlo.');
    }

    tx.set(userRef, userPatch, { merge: true });
    if (publicSnap.exists) {
      tx.set(publicRef, publicPatch, { merge: true });
    } else {
      tx.set(publicRef, {
        ...publicPatch,
        username: userSnap.get('username') ?? null,
        createdAt: now,
      });
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
});

export const deleteUsername = onCall(CALL_OPTIONS, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  const userRef = db().doc(`users/${uid}`);

  return db().runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) return { username: null };
    const username = normalizeUsername(userSnap.get('username'));
    if (username) {
      tx.delete(db().doc(`usernames/${username}`));
    }
    tx.set(userRef, { username: null, updatedAt: Date.now() }, { merge: true });
    tx.set(
      db().doc(`publicProfiles/${uid}`),
      { username: null, updatedAt: Date.now(), removedAt: FieldValue.delete() },
      { merge: true }
    );
    return { username: null };
  });
});
