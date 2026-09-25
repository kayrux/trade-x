import { getMicCurrency } from '../../../lib/constants';
import './SymbolHeading.css';

function SymbolHeading({ symbol, quote, loading }) {
  const price = quote ? parseFloat(quote.last_price) : NaN;
  const hasPrice = !isNaN(price) && price > 0;
  const showPriceSkeleton = !hasPrice && (loading || quote?.price_source === null);
  const prevClose = quote ? parseFloat(quote.prev_close) : NaN;
  const hasChange = hasPrice && !isNaN(prevClose) && prevClose > 0;
  const change = hasChange ? price - prevClose : 0;
  const changePct = hasChange ? (change / prevClose) * 100 : 0;
  const changeDir = change >= 0 ? 'pos' : 'neg';
  const changeText = hasChange
    ? `${change >= 0 ? '+' : ''}$${Math.abs(change).toFixed(2)} (${change >= 0 ? '+' : ''}${changePct.toFixed(2)}%)${quote?.price_source === 'live' ? ' today' : ''}`
    : null;

  const closeLabel = (() => {
    if (!quote?.synced_at) return null;
    const date = new Date(quote.synced_at);
    const tzAbbr =
      new Intl.DateTimeFormat('en-US', {
        timeZoneName: 'short',
        timeZone: 'America/New_York',
      })
        .formatToParts(date)
        .find((p) => p.type === 'timeZoneName')?.value ?? 'ET';
    if (quote?.price_source === 'historical') {
      const datePart = new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'America/New_York',
      }).format(date);
      return `At close: ${datePart} at 4:00 PM ${tzAbbr}`;
    }
    if (quote?.price_source === 'live') {
      const timePart = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York',
      }).format(date);
      return `Last updated: ${timePart} ${tzAbbr}`;
    }
    return null;
  })();

  return (
    <div className="symbol-heading">
      <div className="symbol-heading__row">
        <span className="symbol-heading__ticker">{symbol}</span>
        {quote?.name && <span className="symbol-heading__name">{quote.name}</span>}
      </div>
      {hasPrice ? (
        <div className="symbol-heading__price-row">
          <span className="symbol-heading__price">
            ${price.toFixed(2)}
            {quote?.exchange && getMicCurrency(quote.exchange) && (
              <span className="symbol-heading__currency">
                {getMicCurrency(quote.exchange)}
              </span>
            )}
          </span>
          {changeText && (
            <span className={`symbol-heading__change symbol-heading__change--${changeDir}`}>
              {changeText}
            </span>
          )}
        </div>
      ) : showPriceSkeleton ? (
        <div className="symbol-heading__price-skeleton-row">
          <div className="symbol-heading__price-skeleton" />
          <div className="symbol-heading__change-skeleton" />
        </div>
      ) : null}
      {closeLabel && <span className="symbol-heading__close-label">{closeLabel}</span>}
    </div>
  );
}

export default SymbolHeading;
