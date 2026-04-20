import { useState, useEffect, useRef } from 'react';
import { fetchCandles } from '../lib/api/candles';

export function useCandles(symbol, resolution) {
  const [candles, setCandles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const retryRef = useRef(null);

  useEffect(() => {
    if (retryRef.current) clearTimeout(retryRef.current);
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
        const data = await fetchCandles(symbol, resolution);
        if (cancelled) return;
        setCandles(data.candles);
        // First-ever view: backend sync in progress, retry once after 3s
        if (!isRetry && data.candles.length === 0) {
          retryRef.current = setTimeout(() => load(true), 3000);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load candles');
      } finally {
        if (!cancelled && !isRetry) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [symbol, resolution]);

  return { candles, loading, error };
}
