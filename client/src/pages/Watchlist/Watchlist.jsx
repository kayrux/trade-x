import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, ChevronDown, X } from 'lucide-react';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import SymbolHeading from '../../components/ui/SymbolHeading/SymbolHeading';
import SymbolChart from '../../components/ui/SymbolChart/SymbolChart';
import SymbolDetail from '../../components/ui/SymbolDetail/SymbolDetail';
import CompanyNews from '../../components/ui/CompanyNews/CompanyNews';
import MarketStatus from '../../components/ui/MarketStatus/MarketStatus';
import { useWatchlists } from '../../hooks/useWatchlists';
import { useWatchlistQuotes } from '../../hooks/useWatchlistQuotes';
import { useQuote } from '../../hooks/useQuote';
import { MAX_VISIBLE_WATCHLISTS } from '../../lib/constants';
import './Watchlist.css';

const LAST_VIEWED_KEY = 'trade-x-last-viewed-symbol';

function readLastViewed() {
  try { return localStorage.getItem(LAST_VIEWED_KEY) || null; } catch { return null; }
}

function formatPrice(val) {
  if (val == null) return '—';
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(val) {
  if (val == null) return '';
  const sign = val >= 0 ? '+' : '';
  return `${sign}${val.toFixed(2)}%`;
}

function WatchlistRow({ symbol, quote, active, onSelect, onRemove }) {
  const dir = quote?.changePct == null ? 'neutral' : quote.changePct >= 0 ? 'pos' : 'neg';
  return (
    <div
      className={`watchlist__row${active ? ' watchlist__row--active' : ''}`}
      onClick={() => onSelect(symbol)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(symbol)}
    >
      <div className="watchlist__row-left">
        <span className="watchlist__symbol">{symbol}</span>
        <span className="watchlist__name">{quote?.name ?? ''}</span>
      </div>
      <div className="watchlist__row-right">
        <span className="watchlist__price">{formatPrice(quote?.last_price)}</span>
        <span className={`watchlist__change watchlist__change--${dir}`}>{formatPct(quote?.changePct)}</span>
      </div>
      <button
        className="watchlist__remove"
        aria-label={`Remove ${symbol}`}
        onClick={(e) => { e.stopPropagation(); onRemove(symbol); }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

function Watchlist() {
  const {
    watchlists, activeWatchlist, activeId,
    setActive, createWatchlist, addSymbol, removeSymbol,
  } = useWatchlists();
  const { quotes } = useWatchlistQuotes(activeWatchlist?.symbols ?? []);

  const [selected, setSelected] = useState(readLastViewed);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef(null);

  const symbols = useMemo(() => activeWatchlist?.symbols ?? [], [activeWatchlist]);

  // Default to the first symbol when nothing was last viewed.
  useEffect(() => {
    if (!selected && symbols.length > 0) setSelected(symbols[0]);
  }, [selected, symbols]);

  useEffect(() => {
    if (!overflowOpen) return;
    function onDocClick(e) {
      if (overflowRef.current && !overflowRef.current.contains(e.target)) setOverflowOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [overflowOpen]);

  const { quote, loading } = useQuote(selected);

  function selectSymbol(sym) {
    setSelected(sym);
    try { localStorage.setItem(LAST_VIEWED_KEY, sym); } catch { /* ignore */ }
  }

  function handleCreate() {
    const name = window.prompt('Name your watchlist');
    if (name && name.trim()) createWatchlist(name);
  }

  function handleAddSymbol() {
    const sym = window.prompt('Add a symbol (e.g. AAPL)');
    if (sym && sym.trim()) addSymbol(activeId, sym);
  }

  // Overflow rule: show up to MAX_VISIBLE pills; the last slot becomes a
  // "More" dropdown holding the remaining watchlists.
  const overflows = watchlists.length > MAX_VISIBLE_WATCHLISTS;
  const visible = overflows ? watchlists.slice(0, MAX_VISIBLE_WATCHLISTS - 1) : watchlists;
  const overflow = overflows ? watchlists.slice(MAX_VISIBLE_WATCHLISTS - 1) : [];
  const activeInOverflow = overflow.some((w) => w.id === activeId);

  return (
    <PageLayout>
      <div className="watchlist-page">
        <aside className="watchlist-page__list">
          <div className="watchlist__header">
            <span className="watchlist__title">Watchlists</span>
            <button className="watchlist__icon-btn" onClick={handleCreate} aria-label="New watchlist">
              <Plus size={18} />
            </button>
          </div>

          <div className="watchlist__tabs">
            {visible.map((w) => (
              <button
                key={w.id}
                className={`watchlist__tab${w.id === activeId ? ' watchlist__tab--active' : ''}`}
                onClick={() => setActive(w.id)}
              >
                {w.name}
              </button>
            ))}

            {overflows && (
              <div className="watchlist__overflow" ref={overflowRef}>
                <button
                  className={`watchlist__tab watchlist__tab--more${activeInOverflow ? ' watchlist__tab--active' : ''}`}
                  onClick={() => setOverflowOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={overflowOpen}
                >
                  {activeInOverflow ? overflow.find((w) => w.id === activeId).name : 'More'}
                  <ChevronDown size={14} />
                </button>
                {overflowOpen && (
                  <div className="watchlist__overflow-menu" role="menu">
                    {overflow.map((w) => (
                      <button
                        key={w.id}
                        className={`watchlist__overflow-item${w.id === activeId ? ' watchlist__overflow-item--active' : ''}`}
                        onClick={() => { setActive(w.id); setOverflowOpen(false); }}
                      >
                        {w.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="watchlist__list">
            {symbols.length === 0 ? (
              <p className="watchlist__empty">No symbols yet. Add one to get started.</p>
            ) : (
              symbols.map((sym) => (
                <WatchlistRow
                  key={sym}
                  symbol={sym}
                  quote={quotes[sym.toUpperCase()]}
                  active={sym === selected}
                  onSelect={selectSymbol}
                  onRemove={(s) => removeSymbol(activeId, s)}
                />
              ))
            )}
            <button className="watchlist__add" onClick={handleAddSymbol}>
              <Plus size={16} /> Add symbol
            </button>
          </div>

          <div className="watchlist__footer">
            <MarketStatus />
          </div>
        </aside>

        <section className="watchlist-page__detail">
          {selected ? (
            <div className="watchlist-page__detail-content">
              <SymbolHeading symbol={selected} quote={quote} loading={loading} />
              <div className="watchlist-page__detail-body">
                <SymbolChart symbol={selected} quote={quote} />
                <SymbolDetail symbol={selected} />
              </div>
              <CompanyNews symbol={selected} />
            </div>
          ) : (
            <p className="watchlist-page__prompt">
              Select a symbol from your watchlist to see details.
            </p>
          )}
        </section>
      </div>
    </PageLayout>
  );
}

export default Watchlist;
