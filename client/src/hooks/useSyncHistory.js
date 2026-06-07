import { useState, useEffect } from 'react';
import { fetchSyncHistory } from '../lib/api/picks';

export function useSyncHistory({ channelId } = {}) {
  const [videos, setVideos]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSyncHistory({ channelId: channelId || undefined })
      .then((data) => { if (!cancelled) setVideos(data); })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load sync history'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [channelId, refreshKey]);

  return { videos, loading, error, refresh: () => setRefreshKey((k) => k + 1) };
}
