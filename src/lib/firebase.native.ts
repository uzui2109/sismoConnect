import { getApp, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  firebaseConfig,
  functionsRegion,
  isFirebaseConfigured,
  isFirebaseStorageConfigured,
} from '@/constants/config';

/**
 * Native persistence: AsyncStorage keeps the Firebase session across restarts.
 * The module declaration in `src/types/firebase-rn.d.ts` augments `firebase/auth`
 * so `getReactNativePersistence` is typed even when the bundler selects the
 * browser entry in type-only mode.
 */
let instance: ReturnType<typeof initializeAuth> | null = null;

export function getFirebaseAuth() {
  if (!isFirebaseConfigured) {
    throw new Error('Firebase no está configurado. Revisa tu archivo .env.');
  }

  instance ??= initializeAuth(initializeApp(firebaseConfig), {
    persistence: getReactNativePersistence(AsyncStorage),
  });

  return instance;
}

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