import { useState, useEffect } from 'react';
import { fetchMarketIndices } from '../lib/api/symbols';

export function useMarketSnapshot() {
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchMarketIndices();
        if (!cancelled) setQuotes(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load snapshot');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { quotes, loading, error };
}
