import { useCallback, useEffect, useRef, useState } from 'react';

import { USGS_MIN_REFRESH_MS } from '@/constants/theme';
import { fetchQuakes } from '@/services/usgs';
import type { FeedWindow, Quake } from '@/types/earthquake';

type State = {
  data: Quake[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastUpdated: number | null;
};

/**
 * Polls the USGS summary feed. The feed is cached for 60s upstream, so a
 * faster interval would return identical data and risk an HTTP 429.
 *
 * The request is aborted on unmount and whenever the window changes, so a slow
 * response can never overwrite fresher state.
 */
export function useEarthquakes(window: FeedWindow = 'all_day', autoRefresh = true) {
  const [state, setState] = useState<State>({
    data: [],
    loading: true,
    refreshing: false,
    error: null,
    lastUpdated: null,
  });

  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setState((prev) => ({
      ...prev,
      loading: prev.data.length === 0,
      refreshing: prev.data.length > 0,
      error: null,
    }));

    try {
      const data = await fetchQuakes(window, { signal: controller.signal });

      setState({
        data,
        loading: false,
        refreshing: false,
        error: null,
        lastUpdated: Date.now(),
      });
    } catch (error) {
      // An abort is an expected outcome, not a failure to surface.
      if (controller.signal.aborted) return;

      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error:
          error instanceof Error
            ? error.message
            : 'No se pudo conectar con el servicio de sismos.',
      }));
    }
  }, [window]);

  useEffect(() => {
    void load();
    return () => controllerRef.current?.abort();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => void load(), USGS_MIN_REFRESH_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, load]);

  return { ...state, refetch: load };
}