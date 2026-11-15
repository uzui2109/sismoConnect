import { useCallback, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/providers/auth-provider';
import {
  bootstrapProfile,
  claimUsername as claimUsernameRequest,
  saveProfile,
  socialErrorMessage,
  subscribeToOwnProfile,
  subscribeToPublicProfile,
  updateNotificationPrefs as updateNotificationPrefsRequest,
} from '@/services/social';
import type { NotificationPrefs, PublicProfile, UserProfile } from '@/types/social';

export function useProfile() {
  const { user, isConfigured, isLocalGuest } = useAuth();
  const enabled = isConfigured && user !== null && !isLocalGuest;
  const uid = enabled && user ? user.uid : null;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const bootstrapped = useRef<string | null>(null);
  const inFlightRef = useRef<{ uid: string | null; promise: Promise<UserProfile> | null }>({
    uid: null,
    promise: null,
  });

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    try {
      const unsubscribe = subscribeToOwnProfile(
        uid,
        (next) => {
          if (!active) return;
          setProfile(next);
          setLoading(false);
        },
        (listenerError) => {
          console.log(
            '[useProfile] subscribeToOwnProfile error:',
            listenerError instanceof Error ? listenerError.message : String(listenerError)
          );
          if (!active) return;
          setError(socialErrorMessage(listenerError));
          setLoading(false);
        }
      );

      if (inFlightRef.current?.uid === uid && inFlightRef.current?.promise) {
        // Reutiliza la petición en vuelo para evitar llamadas duplicadas.
        void inFlightRef.current.promise
          .then((next) => {
            if (active) {
              setProfile((current) => current ?? next);
              setError(null);
            }
          })
          .catch((bootstrapError) => {
            if (active) setError(socialErrorMessage(bootstrapError));
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      } else if (bootstrapped.current !== uid) {
        bootstrapped.current = uid;
        const bootstrapPromise = bootstrapProfile()
          .then((next) => {
            if (active) {
              setProfile((current) => current ?? next);
              setError(null);
            }
            return next;
          })
          .catch((bootstrapError) => {
            console.log(
              '[useProfile] bootstrapProfile failed:',
              bootstrapError instanceof Error ? bootstrapError.message : String(bootstrapError)
            );
            if (active) setError(socialErrorMessage(bootstrapError));
            throw bootstrapError;
          })
          .finally(() => {
            if (active) setLoading(false);
            // Libera la referencia solo si sigue siendo la misma petición en vuelo.
            if (inFlightRef.current?.uid === uid) {
              inFlightRef.current = { uid: null, promise: null };
            }
          });
        inFlightRef.current = { uid, promise: bootstrapPromise };
        void bootstrapPromise.catch(() => {});
      } else {
        // Already bootstrapped for this uid, ensure loading doesn't hang
        setLoading(false);
      }

      return () => {
        active = false;
        unsubscribe();
      };
    } catch (effectError) {
      console.log(
        '[useProfile] useEffect crashed:',
        effectError instanceof Error ? effectError.message : String(effectError)
      );
      if (active) {
        setError(socialErrorMessage(effectError));
        setLoading(false);
      }
      return undefined;
    }
  }, [uid]);

  const refresh = useCallback(async () => {
    if (!uid) return null;
    setLoading(true);
    setError(null);
    try {
      // Reutiliza petición en vuelo si corresponde.
      if (inFlightRef.current?.uid === uid && inFlightRef.current?.promise) {
        const next = await inFlightRef.current.promise;
        setProfile((current) => current ?? next);
        setError(null);
        return next;
      }
      const bootstrapPromise = bootstrapProfile().then((next) => {
        if (inFlightRef.current?.uid === uid) {
          inFlightRef.current = { uid: null, promise: null };
        }
        return next;
      });
      inFlightRef.current = { uid, promise: bootstrapPromise };
      const next = await bootstrapPromise;
      setProfile(next);
      setError(null);
      return next;
    } catch (refreshError) {
      console.log(
        '[useProfile] refresh failed:',
        refreshError instanceof Error ? refreshError.message : String(refreshError)
      );
      setError(socialErrorMessage(refreshError));
      throw refreshError;
    } finally {
      setLoading(false);
    }
  }, [uid]);

  const updateProfile = useCallback(async (input: Parameters<typeof saveProfile>[0]) => {
    const next = await saveProfile(input);
    setProfile((current) => (current ? { ...current, ...next } : next));
    return next;
  }, []);

  const claimUsername = useCallback(async (username: string) => {
    const result = await claimUsernameRequest(username);
    setProfile((current) => (current ? { ...current, username: result.username } : current));
    return result.username;
  }, []);

  const updateNotificationPrefs = useCallback(async (prefs: Partial<NotificationPrefs>) => {
    const next = await updateNotificationPrefsRequest(prefs);
    setProfile((current) =>
      current ? { ...current, notificationPrefs: { ...current.notificationPrefs, ...next } } : current
    );
    return next;
  }, []);

  return {
    profile,
    enabled,
    loading,
    error,
    refresh,
    updateProfile,
    claimUsername,
    updateNotificationPrefs,
    clearError: () => setError(null),
  };
}

export function usePublicProfile(uid: string | null) {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    const unsubscribe = subscribeToPublicProfile(
      uid,
      (next) => {
        if (!active) return;
        setProfile(next);
        setLoading(false);
      },
      (listenerError) => {
        if (!active) return;
        setError(socialErrorMessage(listenerError));
        setLoading(false);
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [uid]);

  return { profile, loading, error };
}
