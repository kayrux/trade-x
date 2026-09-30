import { useState, useMemo, useEffect } from 'react';
import { createTrade, updateTrade } from '../../../lib/api/trades';
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

function qtyLabel(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return '—';
  // Trim trailing zeros from the DECIMAL(18,6) the API returns.
  return String(Number(n.toFixed(6)));
}

const numFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function dollar(val) {
  const n = Number(val);
  return Number.isFinite(n) ? `$${numFmt.format(n)}` : '—';
}

const emptyForm = (currency) => ({
  side: 'buy',
  quantity: '',
  price: '',
  currency,
  traded_at: todayStr(),
  note: '',
});

function TradesPanel({ symbol, quote, trades, refetch, onTradeChange, editRequest, onEditHandled }) {
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

  // The activity list lives below the holdings now; its Edit button hands the
  // trade up through the page, which passes it back here to load into the form.
  useEffect(() => {
    if (!editRequest) return;
    setEditingId(editRequest.id);
    setForm({
      side: editRequest.side,
      quantity: qtyLabel(editRequest.quantity),
      price: String(parseFloat(editRequest.price)),
      currency: editRequest.currency,
      traded_at: editRequest.traded_at.split('T')[0],
      note: editRequest.note || '',
    });
    onEditHandled?.();
  }, [editRequest, onEditHandled]);

  // If the trade being edited is deleted (from the activity list), drop back to
  // a blank add form instead of trying to save an id that no longer exists.
  useEffect(() => {
    if (editingId && !trades.some((t) => t.id === editingId)) {
      setForm(emptyForm(defaultCurrency));
      setEditingId(null);
    }
  }, [trades, editingId, defaultCurrency]);

  const resetForm = () => {
    setForm(emptyForm(defaultCurrency));
    setEditingId(null);
  };

  const currencyOptions = useMemo(() => {
    const set = new Set([defaultCurrency, ...CURRENCIES]);
    return [...set];
  }, [defaultCurrency]);

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  // Quantity × price — a live preview of what the trade books, before it's saved.
  const qty = Number(form.quantity);
  const price = Number(form.price);
  const estimatedCost =
    form.quantity !== '' && form.price !== '' && Number.isFinite(qty) && Number.isFinite(price)
      ? qty * price
      : null;

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
      onTradeChange?.();
    } catch (err) {
      showSnackbar({ message: err.message || 'Could not save trade', variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

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

          <div className="trades-panel__estimate">
            <span>Estimated cost</span>
            <span className="trades-panel__estimate-value">
              {estimatedCost != null ? `${dollar(estimatedCost)} ${form.currency}` : '—'}
            </span>
          </div>

          <div className="trades-panel__actions">
            <button type="submit" className="trades-panel__submit" disabled={submitting}>
              {editingId ? 'Save changes' : `Record ${form.side}`}
            </button>
            {editingId && (
              <button type="button" className="trades-panel__cancel" onClick={resetForm}>Cancel</button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}

export default TradesPanel;
