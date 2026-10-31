import { useCallback, useEffect, useState } from 'react';

import { fetchSituationReports, situationErrorMessage } from '@/services/situation';
import type { SituationFeed } from '@/types/situation';

export function useSituationReports() {
  const [data, setData] = useState<SituationFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    try {
      const next = await fetchSituationReports();
      setData(next);
      setError(null);
    } catch (loadError) {
      setError(situationErrorMessage(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, refreshing, error, refetch: () => load(true) };
}
