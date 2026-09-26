import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './NewWatchlistModal.css';

// Name prompt for a watchlist created from the sidebar. The manage dialog has
// its own inline field, so this is only for that entry point.
function NewWatchlistModal({ onCancel, onCreate }) {
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel]);

  function submit(e) {
    e.preventDefault();
    if (name.trim()) onCreate(name.trim());
  }

  return createPortal(
    <div className="new-wl__overlay" onMouseDown={onCancel}>
      <form
        className="new-wl"
        onSubmit={submit}
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="New watchlist"
      >
        <h2 className="new-wl__title">New watchlist</h2>
        <label className="new-wl__label" htmlFor="new-wl-name">Name</label>
        <input
          id="new-wl-name"
          ref={inputRef}
          className="new-wl__input"
          value={name}
          placeholder="e.g. Semis, Dividends, Watch closely"
          onChange={(e) => setName(e.target.value)}
        />
        <div className="new-wl__actions">
          <button type="button" className="new-wl__btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="new-wl__btn new-wl__btn--primary"
            disabled={!name.trim()}
          >
            Create
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

export default NewWatchlistModal;
