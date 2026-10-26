import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously as fbSignInAnonymously,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';

import { isFirebaseConfigured } from '@/constants/config';
import { getFirebaseAuth } from '@/lib/firebase';
import { haptics } from '@/lib/haptics';

/**
 * A trimmed-down view of the session. Screens only need these fields, so the
 * same shape works for a real Firebase user and for the offline guest session
 * that keeps a fresh checkout usable.
 */
export type AppUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAnonymous: boolean;
  emailVerified: boolean;
  isAdmin: boolean;
};

type AuthContextValue = {
  user: AppUser | null;
  /** True until the persisted session is restored, to avoid a login flash. */
  isLoading: boolean;
  /** False when `.env` is missing; the UI then degrades to guest access. */
  isConfigured: boolean;
  /** True when the session is only stored on this device. */
  isLocalGuest: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const GUEST_KEY = 'sismoconnect:guest';
const GUEST_UID = 'local-guest';

const LOCAL_GUEST: AppUser = {
  uid: GUEST_UID,
  email: null,
  displayName: 'Invitado',
  isAnonymous: true,
  emailVerified: false,
  isAdmin: false,
};

function requireConfig(): void {
  if (!isFirebaseConfigured) {
    throw new Error(
      'El acceso con correo necesita Firebase. Copia .env.example a .env y reinicia el servidor.'
    );
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Kept out of state: only auth actions need the Firebase instance itself.
  const firebaseUser = useRef<User | null>(null);

  useEffect(() => {
    if (isFirebaseConfigured) {
      let active = true;
      // Firebase restores the persisted session asynchronously; until it does,
      // the guard would redirect an already-signed-in user to the login screen.
      const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (next) => {
        firebaseUser.current = next;
        if (!next) {
          if (active) {
            setUser(null);
            setIsLoading(false);
          }
          return;
        }

        let isAdmin = false;
        try {
          const token = await next.getIdTokenResult();
          isAdmin = token.claims.admin === true;
        } catch {
          isAdmin = false;
        }
        if (!active) return;
        setUser({
          uid: next.uid,
          email: next.email,
          displayName: next.displayName,
          isAnonymous: next.isAnonymous,
          emailVerified: next.emailVerified,
          isAdmin,
        });
        setIsLoading(false);
      });
      return () => {
        active = false;
        unsubscribe();
      };
    }

    // Without Firebase the app still runs: a device-local guest session is
    // restored so the four screens can be previewed on a fresh checkout.
    void AsyncStorage.getItem(GUEST_KEY)
      .then((stored) => {
        setUser(stored === GUEST_UID ? LOCAL_GUEST : null);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));

    return undefined;
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    requireConfig();
    await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    haptics.success();
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    requireConfig();
    const credential = await createUserWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
    await sendEmailVerification(credential.user);
    haptics.success();
  }, []);

  const signInAsGuest = useCallback(async () => {
    if (isFirebaseConfigured) {
      await fbSignInAnonymously(getFirebaseAuth());
    } else {
      await AsyncStorage.setItem(GUEST_KEY, GUEST_UID).catch(() => {});
      setUser(LOCAL_GUEST);
    }
    haptics.success();
  }, []);

  const sendResetEmail = useCallback(async (email: string) => {
    requireConfig();
    await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
  }, []);

  const resendVerification = useCallback(async () => {
    if (!firebaseUser.current) throw new Error('No hay sesión activa.');
    await sendEmailVerification(firebaseUser.current);
  }, []);

  const signOut = useCallback(async () => {
    if (isFirebaseConfigured) {
      await fbSignOut(getFirebaseAuth());
    }
    await AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
    setUser(null);
    haptics.tap();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isConfigured: isFirebaseConfigured,
      isLocalGuest: user?.uid === GUEST_UID,
      signInWithEmail,
      signUpWithEmail,
      signInAsGuest,
      sendResetEmail,
      resendVerification,
      signOut,
    }),
    [
      user,
      isLoading,
      signInWithEmail,
      signUpWithEmail,
      signInAsGuest,
      sendResetEmail,
      resendVerification,
      signOut,
    ]
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return context;
}