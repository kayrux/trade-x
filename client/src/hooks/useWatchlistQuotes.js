import { useState, useEffect } from 'react';
import { fetchBatchQuotes } from '../lib/api/symbols';
import { WATCHLIST_POLL_INTERVAL_MS } from '../lib/constants';

// Fetches a snapshot quote for each symbol in the list and computes % change
// from last_price vs prev_close. Polls on an interval like useQuote.
// Returns a map keyed by uppercased symbol: { [SYM]: { last_price, change, changePct, ... } }.
export function useWatchlistQuotes(symbols) {
  const [quotes, setQuotes] = useState({});
  const [loading, setLoading] = useState(false);

  // Stable dependency so the effect only re-runs when the set of symbols changes.
  const key = (symbols || []).map((s) => s.toUpperCase()).join(',');

  useEffect(() => {
    const list = key ? key.split(',') : [];
    if (list.length === 0) {
      setQuotes({});
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load({ silent = false } = {}) {
      if (!silent) setLoading(true);
      try {
        // Endpoint caps at 20 symbols; take the first 20 for now.
        const rows = await fetchBatchQuotes(list.slice(0, 20));
        if (cancelled) return;
        const next = {};
        for (const row of rows) {
          const price = row.last_price != null ? parseFloat(row.last_price) : null;
          const prev = row.prev_close != null ? parseFloat(row.prev_close) : null;
          const hasChange = price != null && prev != null && prev !== 0;
          next[row.symbol.toUpperCase()] = {
            symbol: row.symbol,
            name: row.name,
            last_price: price,
            change: hasChange ? price - prev : null,
            changePct: hasChange ? ((price - prev) / prev) * 100 : null,
            synced_at: row.synced_at,
          };
        }
        setQuotes(next);
      } catch {
        /* keep prior quotes on a transient failure */
      } finally {
        if (!cancelled && !silent) setLoading(false);
      }
    }

    load();
    const intervalId = setInterval(() => load({ silent: true }), WATCHLIST_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [key]);

  return { quotes, loading };
}
