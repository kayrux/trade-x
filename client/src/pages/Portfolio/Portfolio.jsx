import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ChevronRight, Landmark, Wallet, Plus } from 'lucide-react';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import ValueChart from '../../components/ui/ValueChart/ValueChart';
import ResolutionSwitcher from '../../components/ui/ResolutionSwitcher/ResolutionSwitcher';
import AccountModal from '../../components/ui/AccountModal/AccountModal';
import { fetchPortfolioSummary, fetchPortfolioHistory } from '../../lib/api/portfolio';
import { useSnackbar } from '../../context/SnackbarContext';
import { accountLabel } from '../../context/AccountContext';
import {
  RANGES,
  rangeSubtitle,
  formatMoney,
  formatSignedMoney,
  formatPercent,
  adjustedSeries,
  seriesChange,
  changeClass,
} from './portfolioFormat';
import './Portfolio.css';

function Portfolio() {
  const navigate = useNavigate();
  const { showSnackbar } = useSnackbar();

  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  const [range, setRange] = useState('YTD');
  const [series, setSeries] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const [hidden, setHidden] = useState(false);
  const [showNewAccount, setShowNewAccount] = useState(false);

  const reportError = useCallback(
    (err) => showSnackbar({ message: err?.message || 'Something went wrong', variant: 'error' }),
    [showSnackbar],
  );

  const loadSummary = useCallback(() => {
    setSummaryLoading(true);
    return fetchPortfolioSummary()
      .then((data) => setSummary(data))
      .catch((err) => reportError(err))
      .finally(() => setSummaryLoading(false));
  }, [reportError]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    fetchPortfolioHistory(range.toLowerCase())
      .then((data) => !cancelled && setSeries(data.series))
      .catch((err) => {
        if (cancelled) return;
        setSeries([]);
        reportError(err);
      })
      .finally(() => !cancelled && setHistoryLoading(false));
    return () => { cancelled = true; };
  }, [range, reportError]);

  const accounts = summary?.accounts ?? [];
  const totalValue = summary?.total_value ?? 0;
  // Deposit-adjusted: contributions are treated as capital present from the
  // start, so a buy isn't read as a gain. The line still ends at current value.
  const chartSeries = useMemo(() => adjustedSeries(series), [series]);
  const change = seriesChange(chartSeries);
  const secret = (node) => (hidden ? '••••••' : node);

  return (
    <PageLayout>
      {showNewAccount && (
        <AccountModal
          onCancel={() => setShowNewAccount(false)}
          onSaved={() => {
            setShowNewAccount(false);
            loadSummary();
          }}
        />
      )}
      <div className="portfolio">
        <header className="portfolio__header">
          <div className="portfolio__value-row">
            <span className="portfolio__value">
              {summaryLoading ? '—' : secret(formatMoney(totalValue))}
            </span>
            <button
              type="button"
              className="portfolio__eye"
              onClick={() => setHidden((h) => !h)}
              aria-label={hidden ? 'Show balance' : 'Hide balance'}
            >
              {hidden ? <Eye size={18} /> : <EyeOff size={18} />}
            </button>
          </div>
          {!summaryLoading && change && (
            <div className={`portfolio__change portfolio__change--${changeClass(change.abs)}`}>
              {hidden
                ? '••••••'
                : `${formatSignedMoney(change.abs)} (${formatPercent(change.pct)}) ${rangeSubtitle(range)}`}
            </div>
          )}
        </header>

        <section className="portfolio__chart-card">
          <ValueChart series={chartSeries} loading={historyLoading} />
          <div className="portfolio__ranges">
            <ResolutionSwitcher resolution={range} onChange={setRange} options={RANGES} />
          </div>
        </section>

        <section className="portfolio__accounts">
          <div className="portfolio__section-header">
            <h2 className="portfolio__section-title">Investing</h2>
            {!summaryLoading && accounts.length > 0 && (
              <button
                type="button"
                className="portfolio__new-account"
                onClick={() => setShowNewAccount(true)}
              >
                <Plus size={16} />
                <span>New account</span>
              </button>
            )}
          </div>

          {summaryLoading ? (
            <div className="portfolio__account-row portfolio__account-row--skeleton" aria-hidden="true">
              <span className="portfolio__skel" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="portfolio__empty">
              <Wallet size={28} />
              <p>No investment accounts yet.</p>
              <span>Create an account (TFSA, RRSP, …) to start tracking your holdings.</span>
              <button
                type="button"
                className="portfolio__new-account portfolio__new-account--empty"
                onClick={() => setShowNewAccount(true)}
              >
                <Plus size={16} />
                <span>New account</span>
              </button>
            </div>
          ) : (
            accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                className="portfolio__account-row"
                onClick={() => navigate(`/account-details/${a.id}`)}
              >
                <span className="portfolio__account-icon">
                  <Landmark size={18} />
                </span>
                <div className="portfolio__account-name">
                  <span className="portfolio__account-title">{accountLabel(a)}</span>
                  {a.name && a.type && <span className="portfolio__account-type">{a.type}</span>}
                </div>
                <div className="portfolio__account-figures">
                  <span className="portfolio__account-value">
                    {secret(formatMoney(a.value))}
                  </span>
                  {a.return_pct != null && (
                    <span className={`portfolio__account-return portfolio__account-return--${changeClass(a.return_abs)}`}>
                      {hidden ? '••••' : `${formatPercent(a.return_pct)} all time`}
                    </span>
                  )}
                </div>
                <ChevronRight size={18} className="portfolio__account-chevron" />
              </button>
            ))
          )}
        </section>
      </div>
    </PageLayout>
  );
}

export default Portfolio;
