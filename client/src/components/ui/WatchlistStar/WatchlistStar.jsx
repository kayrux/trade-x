import { useState, useEffect, useRef } from 'react';
import { Plus, Star } from 'lucide-react';
import { useWatchlists } from '../../../context/WatchlistContext';
import { useSnackbar } from '../../../context/SnackbarContext';
import { DEFAULT_WATCHLIST_NAME } from '../../../lib/constants';
import './WatchlistStar.css';

// The default list is the superset, so "starred" and "on any watchlist" are the
// same state — the star can mean tracked without naming a list. Clicking it
// stars the symbol and opens the dropdown, where the other lists are checkboxes.
// Unchecking the default list untracks the symbol everywhere; the context
// enforces that, this only names it.
const DEFAULT_LIST_LABEL = 'All Symbols';
const DUPLICATE_NAME_MESSAGE = 'You already have a watchlist with that name';

function WatchlistStar({ symbol }) {
  const {
    watchlists, defaultWatchlist, addSymbol, addToDefault, removeSymbol,
    createWatchlist, nameTaken, signedIn, loading,
  } = useWatchlists();
  const { showSnackbar } = useSnackbar();

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const wrapRef = useRef(null);
  const newNameRef = useRef(null);

  // Caught in the field rather than as a snackbar after a rejected request.
  const duplicate = nameTaken(newName);

  const sym = String(symbol || '').toUpperCase().trim();
  const starred = Boolean(defaultWatchlist?.symbols.includes(sym));
  const others = watchlists.filter((w) => w.id !== defaultWatchlist?.id);

  // The dropdown belongs to this symbol — following a link to another one
  // shouldn't leave it open over the new page's star.
  useEffect(() => {
    setOpen(false);
  }, [sym]);

  function stopCreating() {
    setCreating(false);
    setNewName('');
  }

  useEffect(() => {
    if (creating) newNameRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    // Escape backs out one layer at a time: the name field first, then the menu.
    function onKeyDown(e) {
      if (e.key !== 'Escape') return;
      if (creating) stopCreating();
      else setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, creating]);

  // A closed menu has no field to leave open.
  useEffect(() => {
    if (!open) stopCreating();
  }, [open]);

  async function run(action) {
    if (pending) return false;
    setPending(true);
    try {
      return await action();
    } finally {
      setPending(false);
    }
  }

  // Starring an unstarred symbol files it under the default list only — the
  // dropdown opens either way so the other lists are one click further.
  async function handleStarClick() {
    if (!sym) return;
    if (!signedIn) {
      showSnackbar({ message: 'Sign in to save symbols to a watchlist.', variant: 'info' });
      return;
    }
    setOpen(true);
    if (starred) return;
    const ok = await run(() => addToDefault(sym));
    if (ok) showSnackbar(`Added to ${DEFAULT_LIST_LABEL}`);
  }

  async function toggleList(list, checked) {
    const label = list.id === defaultWatchlist?.id ? DEFAULT_LIST_LABEL : list.name;
    const ok = await run(() =>
      checked ? addSymbol(list.id, sym) : removeSymbol(list.id, sym),
    );
    if (ok) showSnackbar(`${checked ? 'Added to' : 'Removed from'} ${label}`);
  }

  // Shown even before the account owns the list, so the first star reads as a
  // checkbox like the rest rather than appearing out of nowhere afterwards.
  async function toggleDefault(checked) {
    if (defaultWatchlist) {
      await toggleList(defaultWatchlist, checked);
      return;
    }
    if (!checked) return;
    const ok = await run(() => addToDefault(sym));
    if (ok) showSnackbar(`Added to ${DEFAULT_LIST_LABEL}`);
  }

  // The new list is born holding this symbol — creating one from here is an
  // act of filing, not of list management. It isn't activated, so the sidebar
  // stays on whatever it was showing.
  async function commitCreate() {
    const name = newName.trim();
    if (!name || duplicate) return;
    stopCreating();

    const ok = await run(async () => {
      const id = await createWatchlist(name, { activate: false });
      // A rejected name has already been surfaced by the context.
      if (!id) return false;
      return addSymbol(id, sym);
    });
    if (ok) showSnackbar(`Added to ${name}`);
  }

  return (
    <div className="watchlist-star" ref={wrapRef}>
      <button
        type="button"
        className={`watchlist-star__btn${starred ? ' watchlist-star__btn--on' : ''}`}
        onClick={handleStarClick}
        disabled={loading}
        aria-expanded={open}
        aria-label={starred ? `${sym} is on your watchlists` : `Add ${sym} to a watchlist`}
      >
        <Star size={20} strokeWidth={1.75} fill={starred ? 'currentColor' : 'none'} />
      </button>

      {open && (
        <div className="watchlist-star__menu" role="group" aria-label="Watchlists">
          <label className="watchlist-star__option">
            <input
              type="checkbox"
              checked={starred}
              disabled={pending}
              onChange={(e) => toggleDefault(e.target.checked)}
            />
            <span>{DEFAULT_WATCHLIST_NAME}</span>
          </label>

          {others.length > 0 && <div className="watchlist-star__divider" />}

          {others.map((w) => (
            <label key={w.id} className="watchlist-star__option">
              <input
                type="checkbox"
                checked={w.symbols.includes(sym)}
                disabled={pending}
                onChange={(e) => toggleList(w, e.target.checked)}
              />
              <span className="watchlist-star__option-name">{w.name}</span>
            </label>
          ))}

          <div className="watchlist-star__divider" />

          {creating ? (
            <div className="watchlist-star__field">
              <input
                ref={newNameRef}
                className="watchlist-star__input"
                value={newName}
                placeholder="Watchlist name"
                aria-label="New watchlist name"
                aria-invalid={duplicate}
                disabled={pending}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitCreate();
                }}
              />
              {duplicate && (
                <p className="watchlist-star__error" role="alert">{DUPLICATE_NAME_MESSAGE}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="watchlist-star__new"
              onClick={() => setCreating(true)}
              disabled={pending}
            >
              <Plus size={14} /> New watchlist
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default WatchlistStar;
