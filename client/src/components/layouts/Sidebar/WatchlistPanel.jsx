import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, Plus, Settings } from 'lucide-react';
import MarketStatus from '../../ui/MarketStatus/MarketStatus';
import Tooltip from '../../ui/Tooltip/Tooltip';
import ManageWatchlistsModal from '../../ui/ManageWatchlistsModal/ManageWatchlistsModal';
import NewWatchlistModal from '../../ui/NewWatchlistModal/NewWatchlistModal';
import { useWatchlists } from '../../../context/WatchlistContext';
import { useWatchlistQuotes } from '../../../hooks/useWatchlistQuotes';
import './WatchlistPanel.css';

function formatPrice(val) {
  if (val == null) return '—';
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(val) {
  if (val == null) return '';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function WatchlistRow({ symbol, quote, active, collapsed, onSelect }) {
  const dir = quote?.changePct == null ? 'neutral' : quote.changePct >= 0 ? 'pos' : 'neg';
  return (
    <div
      className={`watchlist__row${active ? ' watchlist__row--active' : ''}`}
      onClick={() => onSelect(symbol)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(symbol)}
      title={collapsed ? `${symbol} ${formatPrice(quote?.last_price)}` : undefined}
    >
      <div className="watchlist__row-left">
        <span className="watchlist__symbol">{symbol}</span>
        <span className="watchlist__name">{quote?.name ?? ''}</span>
      </div>
      <div className="watchlist__row-right">
        <span className="watchlist__price">{formatPrice(quote?.last_price)}</span>
        <span className={`watchlist__change watchlist__change--${dir}`}>{formatPct(quote?.changePct)}</span>
      </div>
    </div>
  );
}

function WatchlistPanel({ collapsed }) {
  const navigate = useNavigate();
  const { ticker } = useParams();
  const currentSymbol = ticker ? decodeURIComponent(ticker) : null;

  const {
    watchlists, activeWatchlist, activeId, setActive, createWatchlist,
    loading, signedIn,
  } = useWatchlists();
  const { quotes } = useWatchlistQuotes(activeWatchlist?.symbols ?? []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  // Which list the manage dialog should land on — the one just created.
  const [manageStartId, setManageStartId] = useState(null);
  const menuRef = useRef(null);

  const symbols = useMemo(() => activeWatchlist?.symbols ?? [], [activeWatchlist]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  // The collapsed rail shows rows only — there is no header to drive the menu.
  useEffect(() => {
    if (collapsed) setMenuOpen(false);
  }, [collapsed]);

  function selectSymbol(sym) {
    navigate(`/symbol/${encodeURIComponent(sym)}`);
  }

  // Creating from here drops you straight into the manage dialog on the new
  // list, which is where you'd fill it. A failed create keeps the dialog shut —
  // the context has already surfaced why.
  async function handleCreate(name) {
    const id = await createWatchlist(name);
    setNewOpen(false);
    if (!id) return;
    setManageStartId(id);
    setManageOpen(true);
  }

  function openManage() {
    setMenuOpen(false);
    setManageStartId(activeId);
    setManageOpen(true);
  }

  function closeManage() {
    setManageOpen(false);
    setManageStartId(null);
  }

  return (
    <div className="watchlist">
      <div className="watchlist__header">
        <span className="watchlist__title">Watchlist</span>

        {/* Nothing to switch between until you're signed in and own a list.
            With none, the panel body carries the create prompt instead. */}
        <div
          className="watchlist__selector"
          ref={menuRef}
          hidden={!signedIn || watchlists.length === 0}
        >
          <Tooltip label="Switch watchlist">
            <button
              className="watchlist__selector-btn"
              onClick={() => setMenuOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              <span className="watchlist__selector-name">{activeWatchlist?.name ?? 'Watchlist'}</span>
              <ChevronDown size={14} />
            </button>
          </Tooltip>
          {menuOpen && (
            <div className="watchlist__menu" role="menu">
              {watchlists.map((w) => (
                <button
                  key={w.id}
                  className={`watchlist__menu-item${w.id === activeId ? ' watchlist__menu-item--active' : ''}`}
                  onClick={() => { setActive(w.id); setMenuOpen(false); }}
                >
                  {w.name}
                </button>
              ))}
              <button
                className="watchlist__menu-item watchlist__menu-item--new"
                onClick={() => { setMenuOpen(false); setNewOpen(true); }}
              >
                <Plus size={14} /> New watchlist
              </button>
              <button
                className="watchlist__menu-item watchlist__menu-item--action"
                onClick={openManage}
              >
                <Settings size={14} /> Manage watchlists
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="watchlist__list">
        {loading ? (
          <p className="watchlist__empty">Loading…</p>
        ) : !signedIn ? (
          <p className="watchlist__empty">
            <button className="watchlist__link" onClick={() => navigate('/login')}>
              Sign in
            </button>{' '}
            to keep watchlists on your account.
          </p>
        ) : watchlists.length === 0 ? (
          <p className="watchlist__empty">
            No watchlists yet.{' '}
            <button className="watchlist__link" onClick={() => setNewOpen(true)}>
              Create one
            </button>
          </p>
        ) : symbols.length === 0 ? (
          <p className="watchlist__empty">
            No symbols yet.{' '}
            <button className="watchlist__link" onClick={openManage}>
              Add symbols
            </button>
          </p>
        ) : (
          symbols.map((sym) => (
            <WatchlistRow
              key={sym}
              symbol={sym}
              quote={quotes[sym.toUpperCase()]}
              active={sym === currentSymbol}
              collapsed={collapsed}
              onSelect={selectSymbol}
            />
          ))
        )}
      </div>

      <div className="watchlist__footer">
        <MarketStatus />
      </div>

      {newOpen && (
        <NewWatchlistModal onCancel={() => setNewOpen(false)} onCreate={handleCreate} />
      )}

      {manageOpen && (
        <ManageWatchlistsModal onClose={closeManage} initialSelectedId={manageStartId} />
      )}
    </div>
  );
}

export default WatchlistPanel;
