import { createContext, useContext, useState, useCallback } from 'react';

const KEY = 'trade-x-watchlists';

const WatchlistContext = createContext(null);

function makeId() {
  return `wl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

// Seeded on first run so the panel isn't empty (matches the mockup).
function defaultState() {
  const id = makeId();
  return {
    watchlists: [
      { id, name: 'My Watchlist', symbols: ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'BTC', 'ETH'] },
    ],
    activeId: id,
  };
}

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    if (parsed && Array.isArray(parsed.watchlists) && parsed.watchlists.length > 0) {
      return parsed;
    }
  } catch {
    /* fall through to default */
  }
  return defaultState();
}

export function WatchlistProvider({ children }) {
  const [state, setState] = useState(load);

  const update = useCallback((updater) => {
    setState((prev) => {
      const next = updater(prev);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const setActive = useCallback((id) => {
    update((prev) => (prev.watchlists.some((w) => w.id === id) ? { ...prev, activeId: id } : prev));
  }, [update]);

  // `activate: false` leaves the sidebar on whatever list it was showing —
  // the manage dialog creates lists without hijacking it.
  const createWatchlist = useCallback((name, { activate = true } = {}) => {
    const id = makeId();
    const cleanName = (name && name.trim()) || 'New Watchlist';
    update((prev) => ({
      watchlists: [...prev.watchlists, { id, name: cleanName, symbols: [] }],
      activeId: activate ? id : prev.activeId,
    }));
    return id;
  }, [update]);

  const renameWatchlist = useCallback((id, name) => {
    const cleanName = name && name.trim();
    if (!cleanName) return;
    update((prev) => ({
      ...prev,
      watchlists: prev.watchlists.map((w) => (w.id === id ? { ...w, name: cleanName } : w)),
    }));
  }, [update]);

  const deleteWatchlist = useCallback((id) => {
    update((prev) => {
      if (prev.watchlists.length <= 1) return prev; // always keep at least one
      const watchlists = prev.watchlists.filter((w) => w.id !== id);
      const activeId = prev.activeId === id ? watchlists[0].id : prev.activeId;
      return { watchlists, activeId };
    });
  }, [update]);

  const addSymbol = useCallback((id, symbol) => {
    const sym = String(symbol || '').toUpperCase().trim();
    if (!sym) return;
    update((prev) => ({
      ...prev,
      watchlists: prev.watchlists.map((w) =>
        w.id === id && !w.symbols.includes(sym)
          ? { ...w, symbols: [...w.symbols, sym] }
          : w,
      ),
    }));
  }, [update]);

  // Move one symbol to another position in the same list; the stored order is
  // the display order everywhere.
  const reorderSymbols = useCallback((id, from, to) => {
    update((prev) => ({
      ...prev,
      watchlists: prev.watchlists.map((w) => {
        if (w.id !== id) return w;
        const last = w.symbols.length - 1;
        if (from === to || from < 0 || to < 0 || from > last || to > last) return w;
        const symbols = [...w.symbols];
        const [moved] = symbols.splice(from, 1);
        symbols.splice(to, 0, moved);
        return { ...w, symbols };
      }),
    }));
  }, [update]);

  const removeSymbol = useCallback((id, symbol) => {
    update((prev) => ({
      ...prev,
      watchlists: prev.watchlists.map((w) =>
        w.id === id ? { ...w, symbols: w.symbols.filter((s) => s !== symbol) } : w,
      ),
    }));
  }, [update]);

  const activeWatchlist =
    state.watchlists.find((w) => w.id === state.activeId) ?? state.watchlists[0];

  return (
    <WatchlistContext.Provider
      value={{
        watchlists: state.watchlists,
        activeWatchlist,
        activeId: activeWatchlist?.id,
        setActive,
        createWatchlist,
        renameWatchlist,
        deleteWatchlist,
        addSymbol,
        removeSymbol,
        reorderSymbols,
      }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlists() {
  return useContext(WatchlistContext);
}
