import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
import { DEFAULT_WATCHLIST_NAME } from '../lib/constants';

// Watchlists live on the server, one set per account. Only the pointer to the
// list the sidebar is showing is local — that's a per-device UI preference, not
// data worth a round trip on every click.
const ACTIVE_KEY = 'trade-x-active-watchlist';

// Watchlists used to be stored entirely in localStorage under this key. They're
// server-owned now, so the stale blob is cleared on first load rather than left
// to confuse anyone reading storage later.
const LEGACY_KEY = 'trade-x-watchlists';

const WatchlistContext = createContext(null);

function isDefaultList(list) {
  return list.name.trim().toLowerCase() === DEFAULT_WATCHLIST_NAME.toLowerCase();
}

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

  // The default list is the superset: everything on any watchlist is also on
  // it. Its id is mirrored into a ref so a mutation can resolve it without
  // waiting for the render that follows the state update — two adds in one tick
  // would otherwise each decide the list was missing and try to create it.
  const defaultList = watchlists.find(isDefaultList);
  const defaultIdRef = useRef(null);
  // Pinned to the top wherever lists are listed. The sort is stable, so the
  // rest keep the order the server sent.
  const orderedWatchlists = [...watchlists].sort(
    (a, b) => Number(isDefaultList(b)) - Number(isDefaultList(a)),
  );
  useEffect(() => {
    // Recomputed from state, so renaming or deleting the list clears the ref.
    defaultIdRef.current = watchlists.find(isDefaultList)?.id ?? null;
  }, [watchlists]);

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

  // Created on demand rather than at sign-up, and without activating it — the
  // sidebar shouldn't jump lists because a symbol was starred somewhere.
  const ensureDefaultList = useCallback(async () => {
    if (defaultIdRef.current) return defaultIdRef.current;
    const id = await createWatchlist(DEFAULT_WATCHLIST_NAME, { activate: false });
    defaultIdRef.current = id;
    return id;
  }, [createWatchlist]);

  const addOne = useCallback(
    async (id, sym) => {
      try {
        replaceList(await addWatchlistSymbol(id, sym));
        return true;
      } catch (err) {
        reportError(err, 'Could not add symbol');
        return false;
      }
    },
    [replaceList, reportError],
  );

  // Adding anywhere also adds to the default list, so it stays the superset no
  // matter which surface did the adding. Returns whether it all went through.
  const addSymbol = useCallback(
    async (id, symbol) => {
      const sym = String(symbol || '').toUpperCase().trim();
      if (!sym) return false;
      if (!(await addOne(id, sym))) return false;

      if (id === defaultIdRef.current) return true;
      const allId = await ensureDefaultList();
      if (!allId || allId === id) return Boolean(allId);
      return addOne(allId, sym);
    },
    [addOne, ensureDefaultList],
  );

  const addToDefault = useCallback(
    async (symbol) => {
      const sym = String(symbol || '').toUpperCase().trim();
      if (!sym) return false;
      const allId = await ensureDefaultList();
      if (!allId) return false;
      return addOne(allId, sym);
    },
    [addOne, ensureDefaultList],
  );

  // Removing from the default list untracks the symbol outright: it's the
  // superset, so copies left behind in other lists would contradict it. Any
  // other list drops just its own copy.
  const removeSymbol = useCallback(
    async (id, symbol) => {
      const targets =
        id === defaultIdRef.current
          ? watchlists.filter((w) => w.symbols.includes(symbol)).map((w) => w.id)
          : [id];
      if (targets.length === 0) return true;

      // The DELETE answers 204, so rows are dropped locally rather than
      // spending a second request to re-read each list.
      const previous = watchlists;
      const strip = (w) => ({ ...w, symbols: w.symbols.filter((s) => s !== symbol) });
      setWatchlists((prev) => prev.map((w) => (targets.includes(w.id) ? strip(w) : w)));

      const done = new Set();
      try {
        for (const target of targets) {
          await removeWatchlistSymbol(target, symbol);
          done.add(target);
        }
        return true;
      } catch (err) {
        // Only the lists that never got there are put back — the ones the
        // server already dropped are gone whatever the UI shows.
        setWatchlists(previous.map((w) => (done.has(w.id) ? strip(w) : w)));
        reportError(err, 'Could not remove symbol');
        return false;
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

  // With nothing selected the panel lands on the top list, which is the default
  // one — the broadest view is the sensible thing to open on.
  const activeWatchlist =
    watchlists.find((w) => w.id === activeIdState) ?? orderedWatchlists[0];

  return (
    <WatchlistContext.Provider
      value={{
        watchlists: orderedWatchlists,
        activeWatchlist,
        activeId: activeWatchlist?.id,
        // Undefined until the account has starred something — the list is
        // created on first use, not at sign-up.
        defaultWatchlist: defaultList,
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
        addToDefault,
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
