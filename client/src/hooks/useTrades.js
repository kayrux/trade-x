import { useState, useEffect, useCallback } from 'react';
import { fetchTrades, fetchHoldings } from '../lib/api/trades';
import { useAuth } from '../context/AuthContext';

// Loads the signed-in user's trades for one symbol plus that symbol's position.
// Anonymous visitors have neither, so the fetch is skipped and everything stays
// empty. `refetch` re-pulls both so the chart markers and the position summary
// update together after a mutation.
export function useTrades(symbol) {
  const { user, loading: authLoading } = useAuth();
  const [trades, setTrades] = useState([]);
  const [holding, setHolding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(
    async (signal) => {
      if (!symbol || !user) {
        setTrades([]);
        setHolding(null);
        setLoading(false);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [tradeRows, holdings] = await Promise.all([
          fetchTrades(symbol),
          fetchHoldings({ includeFlat: true }),
        ]);
        if (signal?.aborted) return;
        setTrades(tradeRows);
        setHolding(holdings.find((h) => h.symbol === symbol) ?? null);
      } catch (err) {
        if (signal?.aborted) return;
        setError(err.message || 'Failed to load trades');
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [symbol, user],
  );

  // Wait for auth to settle so a signed-in refresh doesn't briefly fetch as
  // anonymous, then reload whenever the symbol or account changes.
  useEffect(() => {
    if (authLoading) return undefined;
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [authLoading, load]);

  const refetch = useCallback(() => load(), [load]);

  return { trades, holding, loading, error, refetch };
}
