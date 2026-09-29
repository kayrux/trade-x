import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import SymbolHeading from '../../components/ui/SymbolHeading/SymbolHeading';
import SymbolChart from '../../components/ui/SymbolChart/SymbolChart';
import SymbolDetail from '../../components/ui/SymbolDetail/SymbolDetail';
import TradesPanel from '../../components/ui/TradesPanel/TradesPanel';
import CompanyNews from '../../components/ui/CompanyNews/CompanyNews';
import WatchlistStar from '../../components/ui/WatchlistStar/WatchlistStar';
import { useQuote } from '../../hooks/useQuote';
import { useTrades } from '../../hooks/useTrades';
import { useAuth } from '../../context/AuthContext';
import { useAccounts } from '../../context/AccountContext';
import './SymbolPage.css';

function SymbolPage() {
  const { ticker } = useParams();
  // Commodities are namespaced (AV:WTI), so links encode the segment.
  const symbol = ticker ? decodeURIComponent(ticker) : null;
  const { quote, loading, error } = useQuote(symbol);
  const { user } = useAuth();
  const { activeAccount } = useAccounts();
  // Lifted here so the chart's markers and the panel's position summary read
  // from one source and both refresh off a single refetch after a mutation.
  // Scoped to the selected account.
  const { trades, holding, loading: tradesLoading, refetch } = useTrades(
    symbol,
    activeAccount?.id,
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
              <SymbolDetail symbol={symbol} quote={quote} loading={loading} error={error} />
            </div>
            {user && (
              <TradesPanel
                symbol={symbol}
                quote={quote}
                trades={trades}
                holding={holding}
                loading={tradesLoading}
                refetch={refetch}
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
