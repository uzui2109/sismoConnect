import { Platform } from 'react-native';

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
} as const;

/**
 * False when `.env` has not been filled in. The app stays usable in that state
 * so a fresh checkout can be previewed before Firebase is wired up.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId
);

export const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? null;

export const platform: 'native' | 'web' = Platform.OS === 'web' ? 'web' : 'native';

export const configurationMessage =
  'Falta configurar Firebase. Copia .env.example a .env con las claves de tu proyecto ' +
  'para activar el inicio de sesión. Puedes entrar como invitado.';