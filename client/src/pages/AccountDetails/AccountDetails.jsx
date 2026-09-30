import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings } from 'lucide-react';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import ValueChart from '../../components/ui/ValueChart/ValueChart';
import ResolutionSwitcher from '../../components/ui/ResolutionSwitcher/ResolutionSwitcher';
import AccountModal from '../../components/ui/AccountModal/AccountModal';
import { fetchAccountDetails, fetchAccountHistory } from '../../lib/api/portfolio';
import { useSnackbar } from '../../context/SnackbarContext';
import { accountLabel } from '../../context/AccountContext';
import {
  RANGES,
  rangeSubtitle,
  formatMoney,
  formatSignedMoney,
  formatPercent,
  formatQty,
  adjustedSeries,
  seriesChange,
  changeClass,
} from '../Portfolio/portfolioFormat';
import './AccountDetails.css';

function HoldingsTable({ holdings, totalValue, navigate }) {
  if (!holdings.length) {
    return <p className="account-details__empty">No open positions in this account.</p>;
  }
  return (
    <div className="account-details__table-wrap">
      <table className="account-details__table">
        <thead>
          <tr>
            <th>Holdings</th>
            <th>Currency</th>
            <th className="num">Allocation</th>
            <th className="num">Quantity</th>
            <th className="num">Price</th>
            <th className="num">Total value</th>
            <th className="num">All-time return</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((h) => {
            const allocation =
              totalValue && h.market_value != null ? (h.market_value / totalValue) * 100 : null;
            return (
              <tr
                key={h.symbol}
                className="account-details__row"
                onClick={() => navigate(`/symbol/${encodeURIComponent(h.symbol)}`)}
              >
                <td>
                  <div className="account-details__sym">
                    <span className="account-details__ticker">{h.symbol}</span>
                    {h.name && <span className="account-details__name">{h.name}</span>}
                  </div>
                </td>
                <td>{h.currency || '—'}</td>
                <td className="num">{allocation != null ? `${allocation.toFixed(2)}%` : '—'}</td>
                <td className="num">{formatQty(h.quantity)}</td>
                <td className="num">{h.price != null ? formatMoney(h.price) : '—'}</td>
                <td className="num account-details__strong">
                  {h.market_value != null ? formatMoney(h.market_value) : '—'}
                </td>
                <td className="num">
                  {h.return_abs != null ? (
                    <div className="account-details__return">
                      <span className={`account-details__return-abs account-details__return-abs--${changeClass(h.return_abs)}`}>
                        {formatSignedMoney(h.return_abs)}
                      </span>
                      {h.return_pct != null && (
                        <span className={`account-details__badge account-details__badge--${changeClass(h.return_abs)}`}>
                          {Math.abs(h.return_pct).toFixed(2)}%
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
  );
}

function AccountDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  const [details, setDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [range, setRange] = useState('YTD');
  const [series, setSeries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const reportError = useCallback(
    (err) => showSnackbar({ message: err?.message || 'Something went wrong', variant: 'error' }),
    [showSnackbar],
  );

  const loadDetails = useCallback(() => {
    setDetailsLoading(true);
    setNotFound(false);
    return fetchAccountDetails(id)
      .then((data) => setDetails(data))
      .catch((err) => {
        if (err?.status === 404) setNotFound(true);
        else reportError(err);
      })
      .finally(() => setDetailsLoading(false));
  }, [id, reportError]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    fetchAccountHistory(id, range.toLowerCase())
      .then((data) => !cancelled && setSeries(data.series))
      .catch((err) => {
        if (cancelled) return;
        setSeries([]);
        if (err?.status !== 404) reportError(err);
      })
      .finally(() => !cancelled && setHistoryLoading(false));
    return () => { cancelled = true; };
  }, [id, range, reportError]);

  const account = details?.account;
  const summary = details?.summary;
  const holdings = details?.holdings ?? [];
  // Deposit-adjusted so buys aren't read as gains (see adjustedSeries).
  const chartSeries = useMemo(() => adjustedSeries(series), [series]);
  const change = seriesChange(chartSeries);

  return (
    <PageLayout>
      {showSettings && account && (
        <AccountModal
          account={account}
          onCancel={() => setShowSettings(false)}
          onSaved={() => {
            setShowSettings(false);
            loadDetails();
          }}
        />
      )}
      <div className="account-details">
        <button type="button" className="account-details__back" onClick={() => navigate('/portfolio')}>
          <ArrowLeft size={16} />
          <span>Portfolio</span>
        </button>

        {notFound ? (
          <div className="account-details__empty account-details__empty--card">
            <p>This account doesn’t exist or isn’t yours.</p>
          </div>
        ) : (
          <>
            <header className="account-details__header">
              <div className="account-details__title-row">
                <h1 className="account-details__title">
                  {account ? accountLabel(account) : '—'}
                </h1>
                {account?.name && account?.type && (
                  <span className="account-details__type">{account.type}</span>
                )}
                {account && (
                  <button
                    type="button"
                    className="account-details__settings"
                    onClick={() => setShowSettings(true)}
                    aria-label="Account settings"
                  >
                    <Settings size={16} />
                  </button>
                )}
              </div>
              <span className="account-details__value">
                {detailsLoading ? '—' : formatMoney(summary?.value ?? 0)}
              </span>
              {!detailsLoading && change && (
                <div className={`account-details__change account-details__change--${changeClass(change.abs)}`}>
                  {`${formatSignedMoney(change.abs)} (${formatPercent(change.pct)}) ${rangeSubtitle(range)}`}
                </div>
              )}
            </header>

            <section className="account-details__chart-card">
              <ValueChart series={chartSeries} loading={historyLoading} />
              <div className="account-details__ranges">
                <ResolutionSwitcher resolution={range} onChange={setRange} options={RANGES} />
              </div>
            </section>

            <section className="account-details__holdings">
              <h2 className="account-details__section-title">Holdings</h2>
              {detailsLoading ? (
                <p className="account-details__empty">Loading holdings…</p>
              ) : (
                <HoldingsTable
                  holdings={holdings}
                  totalValue={summary?.value ?? 0}
                  navigate={navigate}
                />
              )}
            </section>
          </>
        )}
      </div>
    </PageLayout>
  );
}

export default AccountDetails;
