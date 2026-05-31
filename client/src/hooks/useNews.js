import { useState, useEffect } from 'react';
import { fetchNews } from '../lib/api/news';

export function useNews(symbol) {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setNews([]);

    if (!symbol) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchNews(symbol);
        if (!cancelled) {
          setNews(data.news ?? []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load news');
          setLoading(false);
        }
      }
    }

    load();

    return () => { cancelled = true; };
  }, [symbol]);

  return { news, loading, error };
}
