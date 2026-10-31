import { useCallback, useEffect, useState } from 'react';

import { adsEnabled, platform } from '@/constants/config';
import { showRewardedAd } from '@/lib/rewarded-ad';
import { useAuth } from '@/providers/auth-provider';
import {
  fetchRewardState,
  socialErrorMessage,
} from '@/services/social';
import type { RewardState } from '@/types/social';

const EMPTY_STATE: RewardState = { unlocks: 0, lastMessageAt: 0, lastEmergencyAt: 0 };

export function useRewards() {
  const { user, isConfigured, isLocalGuest } = useAuth();
  const enabled = isConfigured && user !== null && !isLocalGuest && adsEnabled && platform === 'native';
  const uid = enabled && user ? user.uid : null;
  const [state, setState] = useState<RewardState>(EMPTY_STATE);
  const [loading, setLoading] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!uid) {
      setState(EMPTY_STATE);
      setLoading(false);
      return EMPTY_STATE;
    }
    setLoading(true);
    try {
      const next = await fetchRewardState();
      setState(next);
      setError(null);
      return next;
    } catch (refreshError) {
      setError(socialErrorMessage(refreshError));
      return EMPTY_STATE;
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (!uid) {
      setState(EMPTY_STATE);
      setLoading(false);
      return;
    }
    void refresh();
  }, [uid, refresh]);

  const watchAd = useCallback(async () => {
    if (!uid) throw new Error('Inicia sesión para desbloquear un envío.');
    setBusy(true);
    setError(null);
    try {
      const result = await showRewardedAd(uid);
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const next = await fetchRewardState();
        setState(next);
        if (next.unlocks > 0) return { ...result, unlocks: next.unlocks };
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      return { ...result, unlocks: 0 };
    } catch (adError) {
      setError(socialErrorMessage(adError));
      throw adError;
    } finally {
      setBusy(false);
    }
  }, [uid]);

  return { enabled, unlocks: state.unlocks, state, loading, busy, error, refresh, watchAd };
}
