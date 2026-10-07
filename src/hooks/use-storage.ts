import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/**
 * AsyncStorage-backed state for preferences that must survive a restart
 * (auth session itself is owned by Firebase, not by this hook).
 */
export function useStoredValue<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const stored = await AsyncStorage.getItem(key);
        if (!cancelled && stored !== null) setValue(JSON.parse(stored) as T);
      } catch {
        // A corrupt or unreadable entry just falls back to the default.
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [key]);

  const persist = useCallback(
    (next: T) => {
      setValue(next);
      void AsyncStorage.setItem(key, JSON.stringify(next)).catch(() => {});
    },
    [key]
  );

  return { value, setValue: persist, hydrated };
}

const HISTORY_KEY = 'sismoconnect:viewed';
const HISTORY_LIMIT = 60;

/** Ids of earthquakes the user opened, most recent first. */
export function useViewedHistory() {
  const { value, setValue } = useStoredValue<string[]>(HISTORY_KEY, []);

  const remember = useCallback(
    (id: string) => {
      setValue([id, ...value.filter((item) => item !== id)].slice(0, HISTORY_LIMIT));
    },
    [setValue, value]
  );

  const clear = useCallback(() => setValue([]), [setValue]);

  return { viewed: value, remember, clear };
}