import { useState, useEffect, useCallback } from 'react';
import { fetchAccountDetails } from '../../../lib/api/portfolio';
import { useAccounts, accountLabel } from '../../../context/AccountContext';
import './SymbolHoldings.css';

const numFmt = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function dollar(val) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? `$${numFmt.format(n)}` : '—';
}

function signedDollar(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n)) return '—';
  return `${n < 0 ? '−' : '+'}$${numFmt.format(Math.abs(n))}`;
}

function qtyLabel(val) {
  const n = parseFloat(val);
  return Number.isFinite(n) ? String(Number(n.toFixed(6))) : '—';
}

function pnlClass(val) {
  const n = parseFloat(val);
  if (!Number.isFinite(n) || n === 0) return 'flat';
  return n > 0 ? 'up' : 'down';
}

// The symbol's position in every account that holds it, one row per account.
// Each account's details carry its own total, so allocation is the position's
// share of that account. refreshKey is bumped by the trade panel after a
// mutation so this reloads alongside the activity list.
function SymbolHoldings({ symbol, refreshKey }) {
  const { accounts, loading: accountsLoading } = useAccounts();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (signal) => {
      if (!accounts.length) {
        setRows([]);
        return;
      }
      setLoading(true);
      try {
        const results = await Promise.all(
          accounts.map((a) =>
            fetchAccountDetails(a.id)
              .then((data) => {
                const position = data.holdings?.find((h) => h.symbol === symbol);
                if (!position || parseFloat(position.quantity) === 0) return null;
                return { account: a, position, accountTotal: data.summary?.value ?? 0 };
              })
              .catch(() => null),
          ),
        );
        if (signal?.aborted) return;
        setRows(results.filter(Boolean));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [accounts, symbol],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load, refreshKey]);

  // Nothing to show until the symbol is held somewhere; stay quiet while loading.
  if (accountsLoading || (loading && rows.length === 0) || !rows.length) return null;

  return (
    <section className="symbol-holdings">
      <div className="symbol-holdings__head">
        <span className="symbol-holdings__title">Stocks</span>
      </div>
      <div className="symbol-holdings__table-wrap">
        <table className="symbol-holdings__table">
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
            {rows.map(({ account, position, accountTotal }) => {
              const allocation =
                accountTotal && position.market_value != null
                  ? (position.market_value / accountTotal) * 100
                  : null;
              return (
                <tr key={account.id}>
                  <td className="symbol-holdings__shares">{qtyLabel(position.quantity)} shares</td>
                  <td>
                    <span className="symbol-holdings__account">{accountLabel(account)}</span>
                  </td>
                  <td className="num">{allocation != null ? `${allocation.toFixed(2)}%` : '—'}</td>
                  <td className="num">{qtyLabel(position.quantity)}</td>
                  <td className="num">{dollar(position.avg_cost)}</td>
                  <td className="num symbol-holdings__strong">
                    {position.market_value != null ? dollar(position.market_value) : '—'}
                  </td>
                  <td className="num">
                    {position.return_abs != null ? (
                      <div className="symbol-holdings__return">
                        <span className={`symbol-holdings__return-abs ${pnlClass(position.return_abs)}`}>
                          {signedDollar(position.return_abs)}
                        </span>
                        {position.return_pct != null && (
                          <span className={`symbol-holdings__badge ${pnlClass(position.return_abs)}`}>
                            {Math.abs(position.return_pct).toFixed(2)}%
                          </span>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default SymbolHoldings;
