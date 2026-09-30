import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import SymbolHeading from '../../components/ui/SymbolHeading/SymbolHeading';
import SymbolChart from '../../components/ui/SymbolChart/SymbolChart';
import SymbolDetail from '../../components/ui/SymbolDetail/SymbolDetail';
import SymbolHoldings from '../../components/ui/SymbolHoldings/SymbolHoldings';
import TradesPanel from '../../components/ui/TradesPanel/TradesPanel';
import TradesActivity from '../../components/ui/TradesActivity/TradesActivity';
import CompanyNews from '../../components/ui/CompanyNews/CompanyNews';
import WatchlistStar from '../../components/ui/WatchlistStar/WatchlistStar';
import { deleteTrade } from '../../lib/api/trades';
import { useQuote } from '../../hooks/useQuote';
import { useTrades } from '../../hooks/useTrades';
import { useAuth } from '../../context/AuthContext';
import { useAccounts, accountLabel } from '../../context/AccountContext';
import { useSnackbar } from '../../context/SnackbarContext';
import './SymbolPage.css';

function SymbolPage() {
  const { ticker } = useParams();
  // Commodities are namespaced (AV:WTI), so links encode the segment.
  const symbol = ticker ? decodeURIComponent(ticker) : null;
  const { quote, loading, error } = useQuote(symbol);
  const { user } = useAuth();
  const { activeAccount } = useAccounts();
  const { showSnackbar } = useSnackbar();
  // Lifted here so the chart's markers, the trade panel's form, and the activity
  // list below the holdings all read from one source and refresh off a single
  // refetch after a mutation. Scoped to the selected account.
  const { trades, loading: tradesLoading, refetch } = useTrades(
    symbol,
    activeAccount?.id,
  );

  // Bumped after a trade mutation so the Stocks card (which aggregates across
  // accounts, independently of the panel's active account) reloads in step.
  const [holdingsVersion, setHoldingsVersion] = useState(0);
  const bumpHoldings = useCallback(() => setHoldingsVersion((v) => v + 1), []);

  // The activity list sits below the holdings, apart from the trade panel's
  // form, so editing a trade hands it back up here for the panel to load.
  const [editRequest, setEditRequest] = useState(null);
  const clearEditRequest = useCallback(() => setEditRequest(null), []);

  const handleDeleteTrade = useCallback(
    async (id) => {
      try {
        await deleteTrade(id);
        showSnackbar({ message: 'Trade deleted', variant: 'success' });
        await refetch();
        bumpHoldings();
      } catch (err) {
        showSnackbar({ message: err.message || 'Could not delete trade', variant: 'error' });
      }
    },
    [refetch, bumpHoldings, showSnackbar],
  );

  // Navigating to a new symbol keeps the previous scroll position, so reset it.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [symbol]);

  return (
    <PageLayout>
      <div className="symbol-page">
        {symbol ? (
          <div className="symbol-page__content">
            <div className="symbol-page__header">
              <SymbolHeading
                symbol={symbol}
                quote={quote}
                loading={loading}
                action={<WatchlistStar symbol={symbol} />}
              />
            </div>
            <div className="symbol-page__body">
              <SymbolChart symbol={symbol} quote={quote} trades={trades} />
              {user && (
                <TradesPanel
                  symbol={symbol}
                  quote={quote}
                  trades={trades}
                  refetch={refetch}
                  onTradeChange={bumpHoldings}
                  editRequest={editRequest}
                  onEditHandled={clearEditRequest}
                />
              )}
            </div>
            <SymbolDetail symbol={symbol} quote={quote} loading={loading} error={error} />
            {user && <SymbolHoldings symbol={symbol} refreshKey={holdingsVersion} />}
            {user && activeAccount && (
              <TradesActivity
                symbol={symbol}
                trades={trades}
                loading={tradesLoading}
                accountName={accountLabel(activeAccount)}
                onEdit={setEditRequest}
                onDelete={handleDeleteTrade}
              />
            )}
            <CompanyNews symbol={symbol} />
          </div>
        ) : (
          <p className="symbol-page__prompt">
            Search for a symbol above to see quote details.
          </p>
        )}
      </div>
    </PageLayout>
  );
}

export default SymbolPage;
