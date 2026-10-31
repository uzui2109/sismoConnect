import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Appearance, Platform } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemePreferenceValue = {
  /** What the user picked in the profile screen. */
  preference: ThemePreference;
  /** What the UI should render right now. */
  resolved: 'light' | 'dark';
  setPreference: (next: ThemePreference) => void;
};

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

const STORAGE_KEY = 'sismoconnect:theme';

/**
 * Owns the single source of truth for the colour scheme so every screen shares
 * one storage read and one OS listener. The resolved value is also pushed to
 * `Appearance` so native bars, dialogs and the Android theme follow the choice.
 */
export function ThemePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const systemScheme = useColorScheme();

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'light' || stored === 'dark' || stored === 'system') {
          setPreferenceState(stored);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const resolvedScheme = preference === 'system' ? systemScheme : preference;

    if (Platform.OS === 'web') {
      // react-native-web has no Appearance.setColorScheme. Colours come from
      // this context, so the browser only needs its own scheme hint for native
      // controls, scrollbars and form widgets.
      const root = (globalThis as { document?: Document }).document?.documentElement;
      if (root) root.style.colorScheme = resolvedScheme;
      return;
    }

    // 'unspecified' hands control back to the OS.
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  }, [preference, systemScheme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const value = useMemo<ThemePreferenceValue>(
    () => ({
      preference,
      resolved: preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference,
      setPreference,
    }),
    [preference, systemScheme, setPreference]
  );

  return <ThemePreferenceContext value={value}>{children}</ThemePreferenceContext>;
}

export function useThemePreference(): ThemePreferenceValue {
  const context = useContext(ThemePreferenceContext);
  if (!context) {
    throw new Error('useThemePreference debe usarse dentro de <ThemePreferenceProvider>.');
  }
  return context;
}