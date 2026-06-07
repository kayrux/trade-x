import { useState, useEffect } from 'react';
import { fetchPicks } from '../lib/api/picks';

export function usePicks({ channelId, sentiment } = {}) {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPicks({ channelId: channelId || undefined, sentiment: sentiment || undefined })
      .then((data) => {
        if (!cancelled) setPicks(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load picks');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [channelId, sentiment, refreshKey]);

  return { picks, loading, error, refresh: () => setRefreshKey((k) => k + 1) };
}
