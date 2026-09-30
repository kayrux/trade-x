import { useState, useMemo, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { createTrade, updateTrade, deleteTrade } from '../../../lib/api/trades';
import { fetchAccountDetails } from '../../../lib/api/portfolio';
import { useSnackbar } from '../../../context/SnackbarContext';
import { useAccounts, accountLabel } from '../../../context/AccountContext';
import { getMicCurrency } from '../../../lib/constants';
import './TradesPanel.css';

// Free-label account types offered in the picker; the server stores whatever
// string it's given, so this list is just a convenience.
const ACCOUNT_TYPES = ['TFSA', 'RRSP', 'FHSA', 'RESP', 'LIRA', 'Margin', 'Cash', 'Other'];
const CURRENCIES = ['USD', 'CAD', 'EUR', 'GBP'];

// Today's calendar day as YYYY-MM-DD for the date input's default. The trade's
// day is what anchors its chart marker, so the local calendar date is the right
// default — not a UTC one that could roll to tomorrow in the evening.
function todayStr() {
  return new Intl.DateTimeFormat('en-CA').format(new Date());
}

const numFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// "$3,975.00" — dollar sign + thousands separators, no currency code.
function dollar(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return '—';
  return `$${numFmt.format(n)}`;
}

// "+$1,706.27" / "−$427.45"
function signedDollar(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return '—';
  return `${n < 0 ? '−' : '+'}$${numFmt.format(Math.abs(n))}`;
}

// "$453.78 USD" — an activity amount, tagged with its currency.
function dollarAmount(val, currency) {
  const base = dollar(val);
  return base !== '—' && currency ? `${base} ${currency}` : base;
}

function sideLabel(side) {
  return side === 'buy' ? 'Buy' : 'Sell';
}

// "YYYY-MM-DD" → "September 24, 2026" in local time (parsed as local midnight so
// the calendar day doesn't shift).
function dateHeading(day) {
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function qtyLabel(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return '—';
  // Trim trailing zeros from the DECIMAL(18,6) the API returns.
  return String(Number(n.toFixed(6)));
}

// up / down / flat, for the pos/neg color classes.
function pnlClass(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n) || n === 0) return 'flat';
  return n > 0 ? 'up' : 'down';
}

const emptyForm = (currency) => ({
  side: 'buy',
  quantity: '',
  price: '',
  currency,
  traded_at: todayStr(),
  note: '',
});

function TradesPanel({ symbol, quote, trades, loading, refetch }) {
  const { showSnackbar } = useSnackbar();
  const {
    accounts,
    activeAccount,
    setActiveAccount,
    createAccount,
  } = useAccounts();

  // Default the trade currency from the symbol's exchange, else USD.
  const defaultCurrency = getMicCurrency(quote?.exchange) || 'USD';

  const [form, setForm] = useState(() => emptyForm(defaultCurrency));
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // First-account creation (empty state only). Managing accounts — creating
  // more, renaming, deleting — lives on the Portfolio / Account Details pages.
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('TFSA');

  // Keep the form's currency default in step with the symbol until the user
  // overrides it (only while adding, not mid-edit).
  useEffect(() => {
    if (!editingId) setForm((f) => ({ ...f, currency: defaultCurrency }));
  }, [defaultCurrency, editingId]);

  const resetForm = () => {
    setForm(emptyForm(defaultCurrency));
    setEditingId(null);
  };

  const currencyOptions = useMemo(() => {
    const set = new Set([defaultCurrency, ...CURRENCIES]);
    return [...set];
  }, [defaultCurrency]);

  // Current position for this symbol in the active account, priced server-side
  // (same source as the Portfolio pages). accountTotal backs the allocation %.
  // Separate from useTrades' `holding` because this row also needs live price,
  // market value, and the account total — so it's reloaded after every mutation.
  const [position, setPosition] = useState(null);
  const [accountTotal, setAccountTotal] = useState(0);
  const [expandedId, setExpandedId] = useState(null);

  const loadPosition = useCallback(async () => {
    if (!activeAccount?.id) {
      setPosition(null);
      setAccountTotal(0);
      return;
    }
    try {
      const data = await fetchAccountDetails(activeAccount.id);
      setAccountTotal(data.summary?.value ?? 0);
      setPosition(data.holdings?.find((h) => h.symbol === symbol) ?? null);
    } catch {
      setPosition(null);
      setAccountTotal(0);
    }
  }, [activeAccount?.id, symbol]);

  useEffect(() => {
    loadPosition();
  }, [loadPosition]);

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const startEdit = (t) => {
    setEditingId(t.id);
    setForm({
      side: t.side,
      quantity: qtyLabel(t.quantity),
      price: String(parseFloat(t.price)),
      currency: t.currency,
      traded_at: t.traded_at.split('T')[0],
      note: t.note || '',
    });
  };

  async function handleCreateAccount(e) {
    e.preventDefault();
    // Nickname is optional; the account falls back to its type for display.
    const created = await createAccount({ name: newName.trim(), type: newType });
    if (created) {
      setNewName('');
      setNewType('TFSA');
    }
  }

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
      currency: form.currency,
      traded_at: form.traded_at,
      note: form.note.trim() || null,
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await updateTrade(editingId, payload);
        showSnackbar({ message: 'Trade updated', variant: 'success' });
      } else {
        await createTrade({ account_id: activeAccount.id, symbol, ...payload });
        showSnackbar({ message: 'Trade recorded', variant: 'success' });
      }
      resetForm();
      await refetch();
      loadPosition();
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
      loadPosition();
    } catch (err) {
      showSnackbar({ message: err.message || 'Could not delete trade', variant: 'error' });
    }
  }

  const hasPosition = position && parseFloat(position.quantity) !== 0;
  const allocation =
    hasPosition && accountTotal && position.market_value != null
      ? (position.market_value / accountTotal) * 100
      : null;

  // Trades are oldest-first; show newest-first, grouped by calendar day.
  const activityGroups = useMemo(() => {
    const groups = [];
    const byDay = new Map();
    for (const t of [...trades].reverse()) {
      const day = t.traded_at.split('T')[0];
      if (!byDay.has(day)) {
        const group = { day, items: [] };
        byDay.set(day, group);
        groups.push(group);
      }
      byDay.get(day).items.push(t);
    }
    return groups;
  }, [trades]);

  // First-account form for the empty state, so a brand-new user can create one
  // account inline and start recording trades without leaving the symbol page.
  const newAccountForm = (
    <form className="trades-panel__account-form" onSubmit={handleCreateAccount}>
      <input
        type="text"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        placeholder="Nickname (optional)"
        maxLength={60}
        autoFocus
      />
      <select value={newType} onChange={(e) => setNewType(e.target.value)}>
        {ACCOUNT_TYPES.map((t) => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
      <div className="trades-panel__actions">
        <button type="submit" className="trades-panel__submit">Create account</button>
      </div>
    </form>
  );

  return (
    <section className="trades-panel">
      <p className="trades-panel__heading">My Trades</p>

      {/* Account selector */}
      <div className="trades-panel__account-bar">
        {accounts.length > 0 && (
          <select
            className="trades-panel__account-select"
            value={activeAccount?.id || ''}
            onChange={(e) => setActiveAccount(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {accountLabel(a)}{a.name && a.type ? ` · ${a.type}` : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {accounts.length === 0 ? (
        <div className="trades-panel__empty-state">
          <p>Create an investment account (TFSA, RRSP, …) to start tracking trades.</p>
          {newAccountForm}
        </div>
      ) : (
        <>

          {/* Current position — only shown when there's an open position */}
          {hasPosition && (
            <div className="trades-position">
              <span className="trades-position__title">Position</span>
              <div className="trades-position__table-wrap">
                <table className="trades-position__table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Account</th>
                      <th className="num">Allocation</th>
                      <th className="num">Qty</th>
                      <th className="num">Avg price</th>
                      <th className="num">Total value</th>
                      <th className="num">All-time return</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="trades-position__shares">{qtyLabel(position.quantity)} shares</td>
                      <td>
                        <span className="trades-position__account">{accountLabel(activeAccount)}</span>
                      </td>
                      <td className="num">{allocation != null ? `${allocation.toFixed(2)}%` : '—'}</td>
                      <td className="num">{qtyLabel(position.quantity)}</td>
                      <td className="num">{dollar(position.avg_cost)}</td>
                      <td className="num trades-position__strong">
                        {position.market_value != null ? dollar(position.market_value) : '—'}
                      </td>
                      <td className="num">
                        {position.return_abs != null ? (
                          <div className="trades-position__return">
                            <span className={`trades-position__return-abs ${pnlClass(position.return_abs)}`}>
                              {signedDollar(position.return_abs)}
                            </span>
                            {position.return_pct != null && (
                              <span className={`trades-position__badge ${pnlClass(position.return_abs)}`}>
                                {Math.abs(position.return_pct).toFixed(2)}%
                              </span>
                            )}
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

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
                <input type="number" min="0" step="any" value={form.quantity} onChange={setField('quantity')} placeholder="0" />
              </label>
              <label className="trades-panel__field">
                <span>Price</span>
                <input type="number" min="0" step="any" value={form.price} onChange={setField('price')} placeholder="0.00" />
              </label>
              <label className="trades-panel__field">
                <span>Currency</span>
                <select value={form.currency} onChange={setField('currency')}>
                  {currencyOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="trades-panel__field">
                <span>Date</span>
                <input type="date" value={form.traded_at} onChange={setField('traded_at')} />
              </label>
            </div>

            <label className="trades-panel__field">
              <span>Note (optional)</span>
              <input type="text" maxLength={280} value={form.note} onChange={setField('note')} placeholder="e.g. earnings dip" />
            </label>

            <div className="trades-panel__actions">
              <button type="submit" className="trades-panel__submit" disabled={submitting}>
                {editingId ? 'Save changes' : `Record ${form.side}`}
              </button>
              {editingId && (
                <button type="button" className="trades-panel__cancel" onClick={resetForm}>Cancel</button>
              )}
            </div>
          </form>

          {/* Recent activity */}
          <div className="trades-activity">
            <span className="trades-activity__title">Recent activity</span>
            {loading && trades.length === 0 ? (
              <p className="trades-panel__empty">Loading activity…</p>
            ) : trades.length === 0 ? (
              <p className="trades-panel__empty">No activity yet for {symbol} in this account.</p>
            ) : (
              activityGroups.map((group) => (
                <div key={group.day} className="trades-activity__group">
                  <span className="trades-activity__date">{dateHeading(group.day)}</span>
                  {group.items.map((t) => {
                    const open = expandedId === t.id;
                    const amount = Number(t.quantity) * Number(t.price);
                    return (
                      <div key={t.id} className="trades-activity__item">
                        <button
                          type="button"
                          className="trades-activity__head"
                          onClick={() => setExpandedId(open ? null : t.id)}
                          aria-expanded={open}
                        >
                          <span className={`trades-activity__icon trades-activity__icon--${t.side}`}>
                            {symbol.replace('AV:', '').slice(0, 2)}
                          </span>
                          <div className="trades-activity__main">
                            <span className="trades-activity__symbol">{symbol}</span>
                            <span className="trades-activity__sub">
                              {sideLabel(t.side)} · {accountLabel(activeAccount)} · {qtyLabel(t.quantity)} shares
                            </span>
                          </div>
                          <div className="trades-activity__right">
                            <span className="trades-activity__amount">
                              {dollarAmount(amount, t.currency)}
                            </span>
                            <ChevronDown
                              size={16}
                              className={`trades-activity__chevron${open ? ' is-open' : ''}`}
                            />
                          </div>
                        </button>
                        {open && (
                          <div className="trades-activity__detail">
                            <div className="trades-activity__detail-grid">
                              <div>
                                <span>Shares</span>
                                <span>{qtyLabel(t.quantity)}</span>
                              </div>
                              <div>
                                <span>Price</span>
                                <span>{dollar(t.price)} {t.currency}</span>
                              </div>
                              <div>
                                <span>Amount</span>
                                <span>{dollarAmount(amount, t.currency)}</span>
                              </div>
                              <div>
                                <span>Date</span>
                                <span>{t.traded_at.split('T')[0]}</span>
                              </div>
                            </div>
                            {t.note && <p className="trades-activity__note">{t.note}</p>}
                            <div className="trades-activity__actions">
                              <button
                                type="button"
                                onClick={() => {
                                  startEdit(t);
                                  setExpandedId(null);
                                }}
                              >
                                Edit
                              </button>
                              <button type="button" onClick={() => handleDelete(t.id)}>
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default TradesPanel;
