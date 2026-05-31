import { useQuote } from '../../../hooks/useQuote';
import { getMicName } from '../../../lib/constants';
import './SymbolDetail.css';

function formatPrice(val) {
  const n = parseFloat(val);
  return isNaN(n) || n === 0 ? '—' : `$${n.toFixed(2)}`;
}

function formatVolume(val) {
  const n = parseInt(val, 10);
  if (isNaN(n) || n === 0) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatMarketCap(val) {
  const n = parseFloat(val); // value is in millions USD
  if (isNaN(n) || n === 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}T`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(2)}B`;
  return `$${n.toFixed(0)}M`;
}

function formatShares(val) {
  const n = parseFloat(val); // value is in millions
  if (isNaN(n) || n === 0) return '—';
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}B`;
  return `${n.toFixed(0)}M`;
}

function formatBeta(val) {
  const n = parseFloat(val);
  return isNaN(n) ? '—' : n.toFixed(2);
}

function formatSyncedLabel(synced_at, price_source) {
  if (!synced_at) return null;
  if (price_source === 'historical') {
    const date = new Date(synced_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `Historical close · ${date}`;
  }
  const diff = Math.floor((Date.now() - new Date(synced_at).getTime()) / 1000);
  if (diff < 60) return 'Updated just now';
  if (diff < 3600) return `Updated ${Math.floor(diff / 60)}m ago`;
  return `Updated ${Math.floor(diff / 3600)}h ago`;
}

function StatCell({ label, value, skeleton }) {
  return (
    <div className="symbol-detail__stat">
      <span className="symbol-detail__stat-label">{label}</span>
      {skeleton
        ? <div className="symbol-detail__stat-skeleton" />
        : <span className="symbol-detail__stat-value">{value}</span>}
    </div>
  );
}

function SymbolDetail({ symbol }) {
  const { quote, loading, error } = useQuote(symbol);

  if (loading && !quote) {
    return (
      <div className="symbol-detail symbol-detail--loading">
        <span className="symbol-detail__spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="symbol-detail symbol-detail--error">
        <p>Failed to load quote for <strong>{symbol}</strong>.</p>
        <p className="symbol-detail__error-msg">{error}</p>
      </div>
    );
  }

  if (!quote) return null;

  const price = parseFloat(quote.last_price);
  const hasPrice = !isNaN(price) && price > 0;
  const syncedLabel = formatSyncedLabel(quote.synced_at, quote.price_source);
  const priceLoading = quote.price_source === null;

  return (
    <div className="symbol-detail">
      <p className="symbol-detail__heading">Market Details</p>
      <div className="symbol-detail__stats">
        <StatCell label="Open"        value={formatPrice(quote.open)}                         skeleton={priceLoading} />
        <StatCell label="High"        value={formatPrice(quote.high)}                         skeleton={priceLoading} />
        <StatCell label="Low"         value={formatPrice(quote.low)}                          skeleton={priceLoading} />
        <StatCell label="Volume"      value={formatVolume(quote.volume)}                      skeleton={priceLoading} />
        <StatCell label="Last Sale"   value={hasPrice ? `$${price.toFixed(2)}` : '—'}        skeleton={priceLoading} />
        <StatCell label="Exchange"    value={quote.exchange ? getMicName(quote.exchange) : '—'} />
        <StatCell label="Market Cap"  value={formatMarketCap(quote.market_cap)} />
        <StatCell label="52-Wk High"  value={formatPrice(quote.week52_high)} />
        <StatCell label="52-Wk Low"   value={formatPrice(quote.week52_low)} />
        <StatCell label="Beta"        value={formatBeta(quote.beta)} />
        <StatCell label="Industry"    value={quote.industry ?? '—'} />
        <StatCell label="Shares Out." value={formatShares(quote.shares_outstanding)} />
      </div>

      {syncedLabel && (
        <p className="symbol-detail__synced">{syncedLabel}</p>
      )}
    </div>
  );
}

export default SymbolDetail;
