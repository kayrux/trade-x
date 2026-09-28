import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  fetchWatchlists,
  createWatchlist as createRequest,
  renameWatchlist as renameRequest,
  deleteWatchlist as deleteRequest,
  addWatchlistSymbol,
  removeWatchlistSymbol,
  setWatchlistSymbolOrder,
} from '../lib/api/watchlists';
import { useAuth } from './AuthContext';
import { useSnackbar } from './SnackbarContext';

// Watchlists live on the server, one set per account. Only the pointer to the
// list the sidebar is showing is local — that's a per-device UI preference, not
// data worth a round trip on every click.
const ACTIVE_KEY = 'trade-x-active-watchlist';

// Watchlists used to be stored entirely in localStorage under this key. They're
// server-owned now, so the stale blob is cleared on first load rather than left
// to confuse anyone reading storage later.
const LEGACY_KEY = 'trade-x-watchlists';

const WatchlistContext = createContext(null);

function loadActiveId() {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    // Private mode / blocked site data — fall back to the first list.
    return null;
  }
}

function storeActiveId(id) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {
    // Non-fatal: the selection just won't survive a reload.
  }
}

export function WatchlistProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { showSnackbar } = useSnackbar();

  const [watchlists, setWatchlists] = useState([]);
  const [activeIdState, setActiveIdState] = useState(loadActiveId);
  // Starts true while auth is still settling so the panel shows its loading
  // state instead of flashing "sign in" at someone who is signed in.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      /* nothing to clean up */
    }
  }, []);

  const reportError = useCallback(
    (err, fallback) => {
      showSnackbar({ message: err?.message || fallback, variant: 'error' });
    },
    [showSnackbar],
  );

  // Load on sign-in, clear on sign-out. Keyed on the user id so switching
  // accounts refetches rather than showing the previous account's lists.
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setWatchlists([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchWatchlists()
      .then((data) => {
        if (!cancelled) setWatchlists(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setWatchlists([]);
        reportError(err, 'Could not load watchlists');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, reportError]);

  const setActive = useCallback((id) => {
    setActiveIdState(id);
    storeActiveId(id);
  }, []);

  // Server responses are whole watchlists, so every mutation ends by swapping
  // one element rather than patching fields.
  const replaceList = useCallback((updated) => {
    setWatchlists((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
  }, []);

  // `activate: false` leaves the sidebar on whatever list it was showing —
  // the manage dialog creates lists without hijacking it.
  const createWatchlist = useCallback(
    async (name, { activate = true } = {}) => {
      try {
        const created = await createRequest(name);
        setWatchlists((prev) => [...prev, created]);
        if (activate) setActive(created.id);
        return created.id;
      } catch (err) {
        reportError(err, 'Could not create watchlist');
        return null;
      }
    },
    [setActive, reportError],
  );

  const renameWatchlist = useCallback(
    async (id, name) => {
      const cleanName = name && name.trim();
      if (!cleanName) return;
      try {
        replaceList(await renameRequest(id, cleanName));
      } catch (err) {
        reportError(err, 'Could not rename watchlist');
      }
    },
    [replaceList, reportError],
  );

  const deleteWatchlist = useCallback(
    async (id) => {
      try {
        await deleteRequest(id);
        const next = watchlists.filter((w) => w.id !== id);
        setWatchlists(next);
        // Deleting the list on screen falls back to the first one left, which
        // may be none — an account with zero watchlists is a valid state.
        if (activeIdState === id) setActive(next[0]?.id ?? null);
      } catch (err) {
        reportError(err, 'Could not delete watchlist');
      }
    },
    [watchlists, activeIdState, setActive, reportError],
  );

  const addSymbol = useCallback(
    async (id, symbol) => {
      const sym = String(symbol || '').toUpperCase().trim();
      if (!sym) return;
      try {
        replaceList(await addWatchlistSymbol(id, sym));
      } catch (err) {
        reportError(err, 'Could not add symbol');
      }
    },
    [replaceList, reportError],
  );

  const removeSymbol = useCallback(
    async (id, symbol) => {
      // The DELETE answers 204, so the row is dropped locally rather than
      // spending a second request to re-read the list.
      const previous = watchlists;
      setWatchlists((prev) =>
        prev.map((w) =>
          w.id === id ? { ...w, symbols: w.symbols.filter((s) => s !== symbol) } : w,
        ),
      );
      try {
        await removeWatchlistSymbol(id, symbol);
      } catch (err) {
        setWatchlists(previous);
        reportError(err, 'Could not remove symbol');
      }
    },
    [watchlists, reportError],
  );

  // Move one symbol to another position in the same list; the stored order is
  // the display order everywhere. Applied locally first so the row lands under
  // the cursor immediately, then persisted as the full new order.
  const reorderSymbols = useCallback(
    async (id, from, to) => {
      const list = watchlists.find((w) => w.id === id);
      if (!list) return;

      const last = list.symbols.length - 1;
      if (from === to || from < 0 || to < 0 || from > last || to > last) return;

      const symbols = [...list.symbols];
      const [moved] = symbols.splice(from, 1);
      symbols.splice(to, 0, moved);

      const previous = watchlists;
      replaceList({ ...list, symbols });

      try {
        replaceList(await setWatchlistSymbolOrder(id, symbols));
      } catch (err) {
        setWatchlists(previous);
        reportError(err, 'Could not reorder symbols');
      }
    },
    [watchlists, replaceList, reportError],
  );

  // Mirrors the server's UNIQUE (user_id, LOWER(name)) so a collision can be
  // caught in the form rather than after a round trip. The server still has the
  // final say — this only saves the user a failed request.
  const nameTaken = useCallback(
    (name, exceptId = null) => {
      const candidate = String(name || '').trim().toLowerCase();
      if (!candidate) return false;
      return watchlists.some(
        (w) => w.id !== exceptId && w.name.trim().toLowerCase() === candidate,
      );
    },
    [watchlists],
  );

  const activeWatchlist =
    watchlists.find((w) => w.id === activeIdState) ?? watchlists[0];

  return (
    <WatchlistContext.Provider
      value={{
        watchlists,
        activeWatchlist,
        activeId: activeWatchlist?.id,
        // Panels need all three to tell "still loading" from "signed out" from
        // "signed in with no lists yet".
        loading: loading || authLoading,
        signedIn: Boolean(user),
        nameTaken,
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
