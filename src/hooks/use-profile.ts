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
<<<<<<< HEAD
import { describeError } from '@/utils/errors';
=======
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46

export function useProfile() {
  const { user, isConfigured, isLocalGuest } = useAuth();
  const enabled = isConfigured && user !== null && !isLocalGuest;
  const uid = enabled && user ? user.uid : null;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const bootstrapped = useRef<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
<<<<<<< HEAD
      setError(null);
=======
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
      return;
    }

    let active = true;
    setLoading(true);
<<<<<<< HEAD
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
          console.error('[useProfile] subscribeToOwnProfile error:', listenerError);
          console.error(
            '[useProfile] subscribeToOwnProfile error details:',
            describeError(listenerError)
          );
          if (!active) return;
          setError(socialErrorMessage(listenerError));
          setLoading(false);
        }
      );

      if (bootstrapped.current !== uid) {
        bootstrapped.current = uid;
        void bootstrapProfile()
          .then((next) => {
            if (active) {
              setProfile((current) => current ?? next);
              setError(null);
            }
          })
          .catch((bootstrapError) => {
            console.error('[useProfile] bootstrapProfile failed:', bootstrapError);
            console.error(
              '[useProfile] bootstrapProfile error details:',
              describeError(bootstrapError)
            );
            if (active) setError(socialErrorMessage(bootstrapError));
          })
          .finally(() => {
            if (active) setLoading(false);
          });
      } else {
        // Already bootstrapped for this uid, ensure loading doesn't hang
        setLoading(false);
      }

      return () => {
        active = false;
        unsubscribe();
      };
    } catch (effectError) {
      console.error('[useProfile] useEffect crashed:', effectError);
      if (active) {
        setError(socialErrorMessage(effectError));
        setLoading(false);
      }
      return undefined;
    }
=======
    const unsubscribe = subscribeToOwnProfile(
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

    if (bootstrapped.current !== uid) {
      bootstrapped.current = uid;
      void bootstrapProfile()
        .then((next) => {
          if (active) {
            setProfile(next);
            setError(null);
          }
        })
        .catch((bootstrapError) => {
          if (active) setError(socialErrorMessage(bootstrapError));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
      unsubscribe();
    };
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
  }, [uid]);

  const refresh = useCallback(async () => {
    if (!uid) return null;
    setLoading(true);
<<<<<<< HEAD
    setError(null);
=======
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
    try {
      const next = await bootstrapProfile();
      setProfile(next);
      setError(null);
      return next;
    } catch (refreshError) {
<<<<<<< HEAD
      console.error('[useProfile] refresh failed:', refreshError);
      console.error('[useProfile] refresh error details:', describeError(refreshError));
=======
>>>>>>> 07708ccf49bb5d28cf4b0096fa88d1c54fa3dd46
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
