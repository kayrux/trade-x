import { useState, useEffect } from 'react';
import { fetchMarketNews } from '../lib/api/news';

export function useMarketNews() {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMarketNews();
        if (!cancelled) {
          setNews(data.news ?? []);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load market news');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { news, loading, error };
}
