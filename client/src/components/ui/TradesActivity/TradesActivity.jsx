import { useState, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import './TradesActivity.css';

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

// The symbol's trade history in the active account. Edit hands the trade back up
// to the panel's form; delete is handled by the page so both the holdings card
// and the chart markers refresh with it.
function TradesActivity({ symbol, trades, loading, accountName, onEdit, onDelete }) {
  const [expandedId, setExpandedId] = useState(null);

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

  return (
    <section className="trades-activity">
      <span className="trades-activity__title">Recent activity</span>
      {loading && trades.length === 0 ? (
        <p className="trades-activity__empty">Loading activity…</p>
      ) : trades.length === 0 ? (
        <p className="trades-activity__empty">No activity yet for {symbol} in this account.</p>
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
                        {sideLabel(t.side)} · {accountName} · {qtyLabel(t.quantity)} shares
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
                            onEdit(t);
                            setExpandedId(null);
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="trades-activity__delete"
                          onClick={() => onDelete(t.id)}
                        >
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
    </section>
  );
}

export default TradesActivity;
