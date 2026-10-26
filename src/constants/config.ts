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

export const isFirebaseStorageConfigured = Boolean(
  isFirebaseConfigured && firebaseConfig.storageBucket
);

export const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID?.trim() || null;

export const platform: 'native' | 'web' = Platform.OS === 'web' ? 'web' : 'native';

export const functionsRegion = 'us-central1';

export const ADMOB_TEST_ANDROID_APP_ID = 'ca-app-pub-3940256099942544~3347511713';
export const ADMOB_TEST_REWARDED_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';

export const admobRewardedUnitId =
  process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID?.trim() || ADMOB_TEST_REWARDED_UNIT_ID;

export const adsEnabled = platform === 'native' && Boolean(admobRewardedUnitId);

export const newsEnabled = process.env.EXPO_PUBLIC_NEWS_ENABLED !== 'false';

export const configurationMessage =
  'Falta configurar Firebase. Copia .env.example a .env con las claves de tu proyecto ' +
  'para activar el inicio de sesión. Puedes entrar como invitado.';