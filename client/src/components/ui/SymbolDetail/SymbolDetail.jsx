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

function formatSyncedAt(synced_at) {
  if (!synced_at) return null;
  const diff = Math.floor((Date.now() - new Date(synced_at).getTime()) / 1000);
  if (diff < 60) return 'Updated just now';
  if (diff < 3600) return `Updated ${Math.floor(diff / 60)}m ago`;
  return `Updated ${Math.floor(diff / 3600)}h ago`;
}

function StatCell({ label, value }) {
  return (
    <div className="symbol-detail__stat">
      <span className="symbol-detail__stat-label">{label}</span>
      <span className="symbol-detail__stat-value">{value}</span>
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
  const syncedLabel = formatSyncedAt(quote.synced_at);

  return (
    <div className="symbol-detail">
      <div className="symbol-detail__header">
        <div className="symbol-detail__identity">
          <span className="symbol-detail__ticker">{quote.symbol}</span>
          <span className="symbol-detail__name">{quote.name}</span>
        </div>
        {quote.exchange && (
          <span className="symbol-detail__exchange">{getMicName(quote.exchange)}</span>
        )}
      </div>

      <div className="symbol-detail__price-row">
        <span className={`symbol-detail__price${hasPrice ? '' : ' symbol-detail__price--empty'}`}>
          {hasPrice ? `$${price.toFixed(2)}` : '—'}
        </span>
        {!hasPrice && (
          <span className="symbol-detail__no-data">No quote data available yet</span>
        )}
      </div>

      <div className="symbol-detail__stats">
        <StatCell label="Open" value={formatPrice(quote.open)} />
        <StatCell label="High" value={formatPrice(quote.high)} />
        <StatCell label="Low" value={formatPrice(quote.low)} />
        <StatCell label="Volume" value={formatVolume(quote.volume)} />
      </div>

      {syncedLabel && (
        <p className="symbol-detail__synced">{syncedLabel}</p>
      )}
    </div>
  );
}

export default SymbolDetail;
