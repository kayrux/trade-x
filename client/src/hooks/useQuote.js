import { useState, useEffect } from 'react';
import { fetchQuote } from '../lib/api/quotes';

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export function useQuote(symbol) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!symbol) {
      setQuote(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchQuote(symbol);
        if (!cancelled) setQuote(data);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load quote');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const intervalId = setInterval(load, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [symbol]);

  return { quote, loading, error };
}
