import { getApp, initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

import {
  firebaseConfig,
  functionsRegion,
  isFirebaseConfigured,
  isFirebaseStorageConfigured,
} from '@/constants/config';

/**
 * Web preview only. `getReactNativePersistence` is not available in a browser
 * bundle, so the web build uses the browser's IndexedDB/localStorage instead.
 *
 * Initialisation is lazy: a checkout without `.env` must still boot so the app
 * can run as a local guest instead of crashing on an invalid Firebase config.
 */
let instance: ReturnType<typeof initializeAuth> | null = null;

export function getFirebaseAuth() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase no está configurado. Revisa tu archivo .env.');
  }

  instance ??= initializeAuth(initializeApp(firebaseConfig), {
    persistence: browserLocalPersistence,
  });

  return instance;
}

/** Browser tabs that already called `getAuth()` reuse the same instance. */
export const firebaseAuth = new Proxy({} as ReturnType<typeof getAuth>, {
  get: (_target, property, receiver) =>
    Reflect.get(
      instance ?? getFirebaseAuth(),
      property,
      receiver
    ) as ReturnType<typeof getAuth>[keyof ReturnType<typeof getAuth>],
});

export function getFirebaseFirestore() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase no está configurado. Revisa tu archivo .env.');
  }

  return getFirestore(instance ? getApp() : initializeApp(firebaseConfig));
}

export function getFirebaseStorage() {
  if (!isFirebaseStorageConfigured) {
    throw new Error('Firebase Storage no está configurado. Añade EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET.');
  }

  return getStorage(instance ? getApp() : initializeApp(firebaseConfig));
}

export function getFirebaseFunctions() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase no está configurado. Revisa tu archivo .env.');
  }

  return getFunctions(instance ? getApp() : initializeApp(firebaseConfig), functionsRegion);
}