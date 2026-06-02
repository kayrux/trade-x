import { useState, useEffect, useRef } from 'react';
import { fetchCandles } from '../lib/api/candles';

const MAX_RETRIES = 10;

export function useCandles(symbol, resolution, range = null) {
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const retryRef = useRef(null);
  const retryCountRef = useRef(0);

  useEffect(() => {
    if (retryRef.current) clearTimeout(retryRef.current);
    retryCountRef.current = 0;
    setCandles([]);

    if (!symbol) {
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    async function load(isRetry = false) {
      if (!isRetry) setLoading(true);
      setError(null);
      try {
        const data = await fetchCandles(symbol, resolution, { range });
        if (cancelled) return;
        setCandles(data.candles);
        if (data.candles.length === 0 && retryCountRef.current < MAX_RETRIES) {
          // Backend sync in progress — keep retrying, keep spinner visible
          retryCountRef.current++;
          retryRef.current = setTimeout(() => load(true), 3000);
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load candles');
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [symbol, resolution, range]);

  return { candles, loading, error };
}
