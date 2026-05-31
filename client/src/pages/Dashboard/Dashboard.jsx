import {
  SelectedSymbolProvider,
  useSelectedSymbol,
} from "../../context/SelectedSymbolContext";
import PageLayout from "../../components/layouts/PageLayout/PageLayout";
import SymbolDetail from "../../components/ui/SymbolDetail/SymbolDetail";
import SymbolChart from "../../components/ui/SymbolChart/SymbolChart";
import CompanyNews from "../../components/ui/CompanyNews/CompanyNews";
import { useQuote } from "../../hooks/useQuote";
import { getMicCurrency } from "../../lib/constants";
import "./Dashboard.css";

function SymbolHeading({ symbol, quote, loading }) {
  const price = quote ? parseFloat(quote.last_price) : NaN;
  const hasPrice = !isNaN(price) && price > 0;
  const showPriceSkeleton = !hasPrice && (loading || quote?.price_source === null);
  const open = quote ? parseFloat(quote.open) : NaN;
  const hasChange = hasPrice && !isNaN(open) && open > 0;
  const change = hasChange ? price - open : 0;
  const changePct = hasChange ? (change / open) * 100 : 0;
  const changeDir = change >= 0 ? "pos" : "neg";
  const changeText = hasChange
    ? `${change >= 0 ? "+" : ""}$${Math.abs(change).toFixed(2)} (${change >= 0 ? "+" : ""}${changePct.toFixed(2)}%) ${quote?.price_source !== "historical" || !quote?.synced_at ? "today" : ""}`
    : null;

  const closeLabel = (() => {
    if (quote?.price_source !== "historical" || !quote?.synced_at) return null;
    const date = new Date(quote.synced_at);
    const datePart = new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "America/New_York",
    }).format(date);
    const tzAbbr =
      new Intl.DateTimeFormat("en-US", {
        timeZoneName: "short",
        timeZone: "America/New_York",
      })
        .formatToParts(date)
        .find((p) => p.type === "timeZoneName")?.value ?? "ET";
    return `At close: ${datePart} at 4:00 PM ${tzAbbr}`;
  })();

  return (
    <div className="dashboard__heading">
      <div className="dashboard__heading-row">
        <span className="dashboard__ticker">{symbol}</span>
        {quote?.name && <span className="dashboard__name">{quote.name}</span>}
      </div>
      {hasPrice ? (
        <div className="dashboard__price-row">
          <span className="dashboard__price">
            ${price.toFixed(2)}
            {quote?.exchange && getMicCurrency(quote.exchange) && (
              <span className="dashboard__currency">
                {getMicCurrency(quote.exchange)}
              </span>
            )}
          </span>
          {changeText && (
            <span
              className={`dashboard__change dashboard__change--${changeDir}`}
            >
              {changeText}
            </span>
          )}
        </div>
      ) : showPriceSkeleton ? (
        <div className="dashboard__price-skeleton-row">
          <div className="dashboard__price-skeleton" />
          <div className="dashboard__change-skeleton" />
        </div>
      ) : null}
      {closeLabel && (
        <span className="dashboard__close-label">{closeLabel}</span>
      )}
    </div>
  );
}

function DashboardContent() {
  const { selectedSymbol } = useSelectedSymbol();
  const { quote, loading } = useQuote(selectedSymbol?.symbol);

  return (
    <div className="dashboard">
      {selectedSymbol ? (
        <div className="dashboard__content">
          <SymbolHeading symbol={selectedSymbol.symbol} quote={quote} loading={loading} />
          <div className="dashboard__body">
            <SymbolChart symbol={selectedSymbol.symbol} quote={quote} />
            <SymbolDetail symbol={selectedSymbol.symbol} />
          </div>
          <CompanyNews symbol={selectedSymbol.symbol} />
        </div>
      ) : (
        <p className="dashboard__prompt">
          Search for a symbol above to see quote details.
        </p>
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
