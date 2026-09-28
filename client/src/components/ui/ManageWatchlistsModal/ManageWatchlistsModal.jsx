import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Pencil, GripVertical, Trash2 } from 'lucide-react';
import SearchBar from '../../forms/SearchBar/SearchBar';
import SymbolSearchResults from '../SymbolSearchResults/SymbolSearchResults';
import Tooltip from '../Tooltip/Tooltip';
import { useSymbolSearch } from '../../../hooks/useSymbolSearch';
import { useWatchlistQuotes } from '../../../hooks/useWatchlistQuotes';
import { useWatchlists } from '../../../context/WatchlistContext';
import { getMicName } from '../../../lib/constants';
import './ManageWatchlistsModal.css';

const DUPLICATE_NAME_MESSAGE = 'You already have a watchlist with that name';

function ManageWatchlistsModal({ onClose, initialSelectedId }) {
  const {
    watchlists, activeId, createWatchlist, deleteWatchlist, renameWatchlist,
    addSymbol, removeSymbol, reorderSymbols, nameTaken,
  } = useWatchlists();

  // Selection here is local: browsing lists in the dialog must not move the
  // sidebar off the list it is showing.
  const [selectedId, setSelectedId] = useState(initialSelectedId ?? activeId);
  const selected = watchlists.find((w) => w.id === selectedId) ?? watchlists[0];
  const symbols = selected?.symbols ?? [];
  const { quotes } = useWatchlistQuotes(symbols);

  // Which list is being renamed, and from where: the detail title or the list
  // column. Both can target the same list, so the source picks the field.
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [query, setQuery] = useState('');
  const [dragIndex, setDragIndex] = useState(null);
  const [dropIndex, setDropIndex] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const searchInputRef = useRef(null);
  const newNameRef = useRef(null);
  const renameRef = useRef(null);
  // Set when Escape cancels, so the blur that follows doesn't commit the edit.
  const cancelledRef = useRef(false);
  const { results, loading, error } = useSymbolSearch(query);

  // Checked as you type, so a colliding name is blocked in the field instead of
  // coming back as a snackbar. Renaming a list to its own name is not a clash.
  const createError = nameTaken(newName) ? DUPLICATE_NAME_MESSAGE : null;
  const renameError =
    renaming && nameTaken(renameValue, renaming.id) ? DUPLICATE_NAME_MESSAGE : null;

  // Clears the field, which also dismisses the results.
  function closeSearch() {
    setQuery('');
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key !== 'Escape') return;
      // Escape backs out one layer at a time.
      if (pendingDelete) setPendingDelete(null);
      else if (query) closeSearch();
      else if (!creating && !renaming) onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [query, creating, renaming, pendingDelete, onClose]);

  useEffect(() => {
    if (creating) newNameRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (renaming) renameRef.current?.select();
  }, [renaming]);

  function startRename(list, source) {
    cancelledRef.current = false;
    setRenameValue(list.name);
    setRenaming({ id: list.id, source });
  }

  // Enter or blur commits; an empty name leaves the current one alone. A name
  // already in use keeps the field open with its message rather than sending a
  // request that the server would only reject.
  function commitRename() {
    if (cancelledRef.current) return;
    if (renameError) return;
    if (renaming && renameValue.trim()) renameWatchlist(renaming.id, renameValue);
    setRenaming(null);
  }

  function cancelRename() {
    cancelledRef.current = true;
    setRenaming(null);
  }

  function renameProps() {
    return {
      ref: renameRef,
      value: renameValue,
      onChange: (e) => setRenameValue(e.target.value),
      onBlur: commitRename,
      onKeyDown: (e) => {
        if (e.key === 'Enter') commitRename();
        else if (e.key === 'Escape') cancelRename();
      },
    };
  }

  function startCreate() {
    cancelledRef.current = false;
    setNewName('');
    setCreating(true);
  }

  // Enter or blur commits; an empty name simply cancels. A duplicate keeps the
  // field open with its message so the name can be fixed in place.
  async function commitCreate() {
    if (cancelledRef.current) return;
    if (createError) return;
    setCreating(false);
    if (!newName.trim()) return;
    const id = await createWatchlist(newName, { activate: false });
    // A rejected name (duplicate, too long) leaves the selection alone; the
    // context has already surfaced the reason.
    if (id) setSelectedId(id);
    setNewName('');
  }

  function cancelCreate() {
    cancelledRef.current = true;
    setCreating(false);
    setNewName('');
  }

  async function confirmDelete() {
    const id = pendingDelete.id;
    setPendingDelete(null);
    await deleteWatchlist(id);
    if (selectedId === id) {
      const next = watchlists.find((w) => w.id !== id);
      setSelectedId(next?.id ?? null);
    }
  }

  // The bar stays open after a pick so several symbols can be added in a row —
  // results swallow the mousedown, so picking one never blurs the input.
  function handleSelect(result) {
    addSymbol(selected.id, result.symbol);
    setQuery('');
    searchInputRef.current?.focus();
  }

  function handleDrop(index) {
    if (dragIndex != null) reorderSymbols(selected.id, dragIndex, index);
    setDragIndex(null);
    setDropIndex(null);
  }

  return createPortal(
    <div className="manage-wl__overlay" onMouseDown={onClose}>
      <div
        className="manage-wl"
        role="dialog"
        aria-modal="true"
        aria-label="Manage watchlists"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="manage-wl__header">
          <h2 className="manage-wl__title">Manage Watchlists</h2>
          <Tooltip label="Close">
            <button className="manage-wl__close" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </Tooltip>
        </header>

        <div className="manage-wl__body">
          <aside className="manage-wl__lists">
            <Tooltip label="Create a new watchlist">
              <button className="manage-wl__create" onClick={startCreate}>
                <Plus size={16} /> Create Watchlist
              </button>
            </Tooltip>
            <div className="manage-wl__list-scroll">
              {creating && (
                <div className="manage-wl__field">
                  <input
                    ref={newNameRef}
                    className="manage-wl__create-input"
                    value={newName}
                    placeholder="Watchlist name"
                    aria-label="New watchlist name"
                    aria-invalid={Boolean(createError)}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={commitCreate}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitCreate();
                      else if (e.key === 'Escape') cancelCreate();
                    }}
                  />
                  {createError && (
                    <p className="manage-wl__field-error" role="alert">{createError}</p>
                  )}
                </div>
              )}
              {watchlists.map((w) => (
                <div
                  key={w.id}
                  className={`manage-wl__list-row${w.id === selected?.id ? ' manage-wl__list-row--active' : ''}`}
                >
                  {renaming?.id === w.id && renaming.source === 'list' ? (
                    <div className="manage-wl__field">
                      <input
                        className="manage-wl__rename-input"
                        aria-label="Watchlist name"
                        aria-invalid={Boolean(renameError)}
                        {...renameProps()}
                      />
                      {renameError && (
                        <p className="manage-wl__field-error" role="alert">{renameError}</p>
                      )}
                    </div>
                  ) : (
                    <button
                      className="manage-wl__list-item"
                      onClick={() => setSelectedId(w.id)}
                      onDoubleClick={() => startRename(w, 'list')}
                    >
                      {w.name} ({w.symbols.length})
                    </button>
                  )}
                  {/* Deleting the last list is allowed — an account with no
                      watchlists is a valid state. */}
                  <button
                    className="manage-wl__list-delete"
                    onClick={() => setPendingDelete(w)}
                    aria-label={`Delete ${w.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          <section className="manage-wl__detail">
            {!selected ? (
              <p className="manage-wl__empty">
                No watchlists yet. Use Create Watchlist to add one.
              </p>
            ) : (
            <>
            <div className="manage-wl__detail-header">
              {renaming?.id === selected?.id && renaming.source === 'title' ? (
                // Floating message: the header is a fixed-height row, so the
                // error can't take space in the flow here.
                <div className="manage-wl__field manage-wl__field--float">
                  <input
                    className="manage-wl__title-input"
                    aria-label="Watchlist name"
                    aria-invalid={Boolean(renameError)}
                    {...renameProps()}
                  />
                  {renameError && (
                    <p className="manage-wl__field-error" role="alert">{renameError}</p>
                  )}
                </div>
              ) : (
                <>
                  <h3
                    className="manage-wl__detail-title"
                    onDoubleClick={() => selected && startRename(selected, 'title')}
                  >
                    {selected?.name}
                  </h3>
                  <button
                    className="manage-wl__edit-btn"
                    onClick={() => selected && startRename(selected, 'title')}
                    aria-label="Rename watchlist"
                  >
                    <Pencil size={16} />
                  </button>
                </>
              )}

              {/* Always present rather than hidden behind an add button —
                  filling a watchlist is what this dialog is for. Positioned so
                  the results drop out of the field. */}
              <div className="manage-wl__search">
                <SearchBar
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onClear={closeSearch}
                  inputRef={searchInputRef}
                  placeholder="Search symbols to add..."
                  ariaLabel="Search symbols to add"
                  // Same blur delay the navbar uses, so a click elsewhere in
                  // the dialog lands before the results close.
                  onBlur={() => setTimeout(closeSearch, 150)}
                />

                <SymbolSearchResults
                  results={results}
                  loading={loading}
                  error={error}
                  visible={query.trim().length > 0}
                  onSelect={handleSelect}
                />
              </div>
            </div>

            <div className="manage-wl__table">
              <div className="manage-wl__table-head">
                <span />
                <span>Symbol</span>
                <span>Name</span>
                <span>Market</span>
                <span />
              </div>
              <div className="manage-wl__table-body">
                {symbols.length === 0 ? (
                  <p className="manage-wl__empty">
                    This watchlist is empty. Use Add Symbol to fill it.
                  </p>
                ) : (
                  symbols.map((sym, i) => {
                    const quote = quotes[sym.toUpperCase()];
                    const state = dragIndex === i
                      ? ' manage-wl__row--dragging'
                      : dropIndex === i ? ' manage-wl__row--drop' : '';
                    return (
                      <div
                        key={sym}
                        className={`manage-wl__row${state}`}
                        // Reordering stays available whether or not edit mode is on.
                        draggable
                        onDragStart={() => setDragIndex(i)}
                        onDragOver={(e) => { e.preventDefault(); setDropIndex(i); }}
                        onDragLeave={() => setDropIndex((d) => (d === i ? null : d))}
                        onDrop={(e) => { e.preventDefault(); handleDrop(i); }}
                        onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
                      >
                        <Tooltip label="Drag to reorder">
                          <span className="manage-wl__row-grip" aria-hidden="true">
                            <GripVertical size={14} />
                          </span>
                        </Tooltip>
                        <span className="manage-wl__row-symbol">{sym}</span>
                        <span className="manage-wl__row-name">{quote?.name ?? '—'}</span>
                        <span className="manage-wl__row-market">
                          {quote?.exchange ? getMicName(quote.exchange) : '—'}
                        </span>
                        <button
                          className="manage-wl__row-remove"
                          onClick={() => removeSymbol(selected.id, sym)}
                          aria-label={`Remove ${sym}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            </>
            )}
          </section>
        </div>

        {pendingDelete && (
          <div className="manage-wl__confirm-overlay" onMouseDown={() => setPendingDelete(null)}>
            <div
              className="manage-wl__confirm"
              role="alertdialog"
              aria-modal="true"
              aria-label="Confirm delete"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <h3 className="manage-wl__confirm-title">Delete watchlist?</h3>
              <p className="manage-wl__confirm-text">
                <strong>{pendingDelete.name}</strong> and its {pendingDelete.symbols.length}{' '}
                {pendingDelete.symbols.length === 1 ? 'symbol' : 'symbols'} will be removed.
                This can&apos;t be undone.
              </p>
              <div className="manage-wl__confirm-actions">
                <button
                  className="manage-wl__confirm-btn"
                  onClick={() => setPendingDelete(null)}
                >
                  Cancel
                </button>
                <button
                  className="manage-wl__confirm-btn manage-wl__confirm-btn--danger"
                  onClick={confirmDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export default ManageWatchlistsModal;
