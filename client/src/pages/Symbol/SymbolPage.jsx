import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import SymbolHeading from '../../components/ui/SymbolHeading/SymbolHeading';
import SymbolChart from '../../components/ui/SymbolChart/SymbolChart';
import SymbolDetail from '../../components/ui/SymbolDetail/SymbolDetail';
import CompanyNews from '../../components/ui/CompanyNews/CompanyNews';
import WatchlistStar from '../../components/ui/WatchlistStar/WatchlistStar';
import { useQuote } from '../../hooks/useQuote';
import './SymbolPage.css';

function SymbolPage() {
  const { ticker } = useParams();
  // Commodities are namespaced (AV:WTI), so links encode the segment.
  const symbol = ticker ? decodeURIComponent(ticker) : null;
  const { quote, loading, error } = useQuote(symbol);

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
              <SymbolChart symbol={symbol} quote={quote} />
              <SymbolDetail symbol={symbol} quote={quote} loading={loading} error={error} />
            </div>
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
