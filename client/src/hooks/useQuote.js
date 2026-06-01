import { useState, useEffect, useRef } from 'react';
import { fetchQuote } from '../lib/api/quotes';

const POLL_INTERVAL_MS = 60 * 1000;
const PRICE_RETRY_MS = 5 * 1000;
const MAX_PRICE_RETRIES = 12; // up to 60 s

export function useQuote(symbol) {
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const retryRef = useRef(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (retryRef.current) clearTimeout(retryRef.current);
    retryCountRef.current = 0;
    setQuote(null);
    setLoading(false);
    setError(null);

    if (!symbol) return;

    let cancelled = false;

    async function load({ silent = false } = {}) {
      if (!silent) setLoading(true);
      if (!silent) setError(null);
      try {
        const data = await fetchQuote(symbol);
        if (cancelled) return;
        setQuote(data);
        if (data.price_source === null && retryCountRef.current < MAX_PRICE_RETRIES) {
          retryCountRef.current++;
          retryRef.current = setTimeout(() => load({ silent: true }), PRICE_RETRY_MS);
        }
      } catch (err) {
        if (!cancelled && !silent) setError(err.message || 'Failed to load quote');
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    }

    load();
    const intervalId = setInterval(() => load(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [symbol]);

  return { quote, loading, error };
}
