import { SelectedSymbolProvider, useSelectedSymbol } from '../../context/SelectedSymbolContext';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import SymbolDetail from '../../components/ui/SymbolDetail/SymbolDetail';
import SymbolChart from '../../components/ui/SymbolChart/SymbolChart';
import { useQuote } from '../../hooks/useQuote';
import { getMicCurrency } from '../../lib/constants';
import './Dashboard.css';

function SymbolHeading({ quote }) {
  const price = quote ? parseFloat(quote.last_price) : NaN;
  const hasPrice = !isNaN(price) && price > 0;
  const open = quote ? parseFloat(quote.open) : NaN;
  const hasChange = hasPrice && !isNaN(open) && open > 0;
  const change = hasChange ? price - open : 0;
  const changePct = hasChange ? (change / open) * 100 : 0;
  const changeDir = change >= 0 ? 'pos' : 'neg';
  const changeText = hasChange
    ? `${change >= 0 ? '+' : ''}$${Math.abs(change).toFixed(2)} (${change >= 0 ? '+' : ''}${changePct.toFixed(2)}%) today`
    : null;

  const symbol = quote?.symbol;

  return (
    <div className="dashboard__heading">
      <div className="dashboard__heading-row">
        <span className="dashboard__ticker">{symbol}</span>
        {quote?.name && <span className="dashboard__name">{quote.name}</span>}
      </div>
      {hasPrice && (
        <div className="dashboard__price-row">
          <span className="dashboard__price">
            ${price.toFixed(2)}
            {quote?.exchange && getMicCurrency(quote.exchange) && (
              <span className="dashboard__currency">{getMicCurrency(quote.exchange)}</span>
            )}
          </span>
          {changeText && (
            <span className={`dashboard__change dashboard__change--${changeDir}`}>{changeText}</span>
          )}
        </div>
      )}
    </div>
  );
}

function DashboardContent() {
  const { selectedSymbol } = useSelectedSymbol();
  const { quote } = useQuote(selectedSymbol?.symbol);

  return (
    <div className="dashboard">
      {selectedSymbol ? (
        <div className="dashboard__content">
          <SymbolHeading quote={quote} />
          <div className="dashboard__body">
            <SymbolChart symbol={selectedSymbol.symbol} quote={quote} />
            <SymbolDetail symbol={selectedSymbol.symbol} />
          </div>
        </div>
      ) : (
        <p className="dashboard__prompt">Search for a symbol above to see quote details.</p>
      )}
    </div>
  );
}

function Dashboard() {
  return (
    <SelectedSymbolProvider>
      <PageLayout>
        <DashboardContent />
      </PageLayout>
    </SelectedSymbolProvider>
  );
}

export default Dashboard;
