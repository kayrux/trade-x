import { useState, useMemo } from 'react';
import { createTrade, updateTrade, deleteTrade } from '../../../lib/api/trades';
import { useSnackbar } from '../../../context/SnackbarContext';
import './TradesPanel.css';

// Today's calendar day as YYYY-MM-DD for the date input's default. The trade's
// day is what anchors its chart marker, so the local calendar date is the right
// default — not a UTC one that could roll to tomorrow in the evening.
function todayStr() {
  return new Intl.DateTimeFormat('en-CA').format(new Date());
}

function money(val) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '—';
}

function signedMoney(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n) || n === 0) return '$0.00';
  return `${n < 0 ? '-' : '+'}$${Math.abs(n).toFixed(2)}`;
}

function qtyLabel(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return '—';
  // Trim trailing zeros from the DECIMAL(18,6) the API returns.
  return String(Number(n.toFixed(6)));
}

const EMPTY_FORM = { side: 'buy', quantity: '', price: '', traded_at: '', note: '' };

function TradesPanel({ symbol, quote, trades, holding, loading, refetch }) {
  const { showSnackbar } = useSnackbar();
  const [form, setForm] = useState({ ...EMPTY_FORM, traded_at: todayStr() });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setForm({ ...EMPTY_FORM, traded_at: todayStr() });
    setEditingId(null);
  };

  // Unrealized P&L from the live quote, since the page already holds it.
  const unrealized = useMemo(() => {
    if (!holding) return null;
    const qty = parseFloat(holding.quantity);
    const avg = parseFloat(holding.avg_cost);
    const last = parseFloat(quote?.last_price);
    if (!qty || !Number.isFinite(avg) || !Number.isFinite(last)) return null;
    return (last - avg) * qty;
  }, [holding, quote]);

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const startEdit = (t) => {
    setEditingId(t.id);
    setForm({
      side: t.side,
      quantity: qtyLabel(t.quantity),
      price: String(parseFloat(t.price)),
      traded_at: t.traded_at.split('T')[0],
      note: t.note || '',
    });
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const quantity = Number(form.quantity);
    const price = Number(form.price);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      showSnackbar({ message: 'Enter a quantity greater than 0', variant: 'error' });
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      showSnackbar({ message: 'Enter a valid price', variant: 'error' });
      return;
    }
    if (!form.traded_at) {
      showSnackbar({ message: 'Pick a trade date', variant: 'error' });
      return;
    }

    const payload = {
      side: form.side,
      quantity,
      price,
      traded_at: form.traded_at,
      note: form.note.trim() || null,
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await updateTrade(editingId, payload);
        showSnackbar({ message: 'Trade updated', variant: 'success' });
      } else {
        await createTrade({ symbol, ...payload });
        showSnackbar({ message: 'Trade recorded', variant: 'success' });
      }
      resetForm();
      await refetch();
    } catch (err) {
      showSnackbar({ message: err.message || 'Could not save trade', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteTrade(id);
      if (editingId === id) resetForm();
      showSnackbar({ message: 'Trade deleted', variant: 'success' });
      await refetch();
    } catch (err) {
      showSnackbar({ message: err.message || 'Could not delete trade', variant: 'error' });
    }
  }

  const hasPosition = holding && parseFloat(holding.quantity) !== 0;

  return (
    <section className="trades-panel">
      <p className="trades-panel__heading">My Trades</p>

      {/* Position summary */}
      <div className="trades-panel__position">
        <div className="trades-panel__pos-cell">
          <span className="trades-panel__pos-label">Shares</span>
          <span className="trades-panel__pos-value">
            {hasPosition ? qtyLabel(holding.quantity) : '—'}
          </span>
        </div>
        <div className="trades-panel__pos-cell">
          <span className="trades-panel__pos-label">Avg Cost</span>
          <span className="trades-panel__pos-value">
            {hasPosition ? money(holding.avg_cost) : '—'}
          </span>
        </div>
        <div className="trades-panel__pos-cell">
          <span className="trades-panel__pos-label">Unrealized</span>
          <span
            className={`trades-panel__pos-value ${unrealized != null ? pnlClass(unrealized) : ''}`}
          >
            {unrealized != null ? signedMoney(unrealized) : '—'}
          </span>
        </div>
        <div className="trades-panel__pos-cell">
          <span className="trades-panel__pos-label">Realized</span>
          <span
            className={`trades-panel__pos-value ${holding ? pnlClass(holding.realized_pnl) : ''}`}
          >
            {holding ? signedMoney(holding.realized_pnl) : '$0.00'}
          </span>
        </div>
      </div>

      {/* Add / edit form */}
      <form className="trades-panel__form" onSubmit={handleSubmit}>
        <div className="trades-panel__side-toggle" role="group" aria-label="Trade side">
          <button
            type="button"
            className={`trades-panel__side trades-panel__side--buy ${form.side === 'buy' ? 'is-active' : ''}`}
            onClick={() => setForm((f) => ({ ...f, side: 'buy' }))}
          >
            Buy
          </button>
          <button
            type="button"
            className={`trades-panel__side trades-panel__side--sell ${form.side === 'sell' ? 'is-active' : ''}`}
            onClick={() => setForm((f) => ({ ...f, side: 'sell' }))}
          >
            Sell
          </button>
        </div>

        <div className="trades-panel__fields">
          <label className="trades-panel__field">
            <span>Quantity</span>
            <input
              type="number"
              min="0"
              step="any"
              value={form.quantity}
              onChange={setField('quantity')}
              placeholder="0"
            />
          </label>
          <label className="trades-panel__field">
            <span>Price</span>
            <input
              type="number"
              min="0"
              step="any"
              value={form.price}
              onChange={setField('price')}
              placeholder="0.00"
            />
          </label>
          <label className="trades-panel__field">
            <span>Date</span>
            <input type="date" value={form.traded_at} onChange={setField('traded_at')} />
          </label>
        </div>

        <label className="trades-panel__field">
          <span>Note (optional)</span>
          <input
            type="text"
            maxLength={280}
            value={form.note}
            onChange={setField('note')}
            placeholder="e.g. earnings dip"
          />
        </label>

        <div className="trades-panel__actions">
          <button type="submit" className="trades-panel__submit" disabled={submitting}>
            {editingId ? 'Save changes' : `Record ${form.side}`}
          </button>
          {editingId && (
            <button type="button" className="trades-panel__cancel" onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </form>

      {/* Trade history */}
      <div className="trades-panel__list">
        {loading && trades.length === 0 ? (
          <p className="trades-panel__empty">Loading trades…</p>
        ) : trades.length === 0 ? (
          <p className="trades-panel__empty">No trades yet for {symbol}.</p>
        ) : (
          trades
            .slice()
            .reverse()
            .map((t) => (
              <div key={t.id} className="trades-panel__row">
                <span className={`trades-panel__badge trades-panel__badge--${t.side}`}>
                  {t.side === 'buy' ? 'B' : 'S'}
                </span>
                <div className="trades-panel__row-main">
                  <span className="trades-panel__row-line">
                    {qtyLabel(t.quantity)} @ {money(t.price)}
                  </span>
                  <span className="trades-panel__row-date">
                    {t.traded_at.split('T')[0]}
                    {t.note ? ` · ${t.note}` : ''}
                  </span>
                </div>
                <div className="trades-panel__row-actions">
                  <button type="button" onClick={() => startEdit(t)}>Edit</button>
                  <button type="button" onClick={() => handleDelete(t.id)}>Delete</button>
                </div>
              </div>
            ))
        )}
      </div>
    </section>
  );
}

function pnlClass(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n) || n === 0) return '';
  return n > 0 ? 'trades-panel__pos-value--up' : 'trades-panel__pos-value--down';
}

export default TradesPanel;
