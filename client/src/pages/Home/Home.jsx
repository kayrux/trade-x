import { useNavigate } from 'react-router-dom';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import { useMarketSnapshot } from '../../hooks/useMarketSnapshot';
import { useMarketNews } from '../../hooks/useMarketNews';
import './Home.css';

const STOCK_SYMBOLS = new Set(['SPY', 'QQQ', 'DIA']);

function formatPrice(val) {
  if (val == null) return '—';
  return `$${parseFloat(val).toFixed(2)}`;
}

function formatChange(change, changePct) {
  if (change == null) return '—';
  const sign = change >= 0 ? '+' : '';
  return `${sign}$${Math.abs(change).toFixed(2)}  ${sign}${changePct.toFixed(2)}%`;
}

function formatSynced(synced_at) {
  if (!synced_at) return null;
  const mins = Math.max(1, Math.floor((Date.now() - new Date(synced_at).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

function formatNewsDate(datetime) {
  return new Date(datetime * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

function TickerCard({ quote, onClick }) {
  const direction = quote.change == null ? null : quote.change >= 0 ? 'pos' : 'neg';
  const clickable = !!onClick;
  return (
    <div
      className={`ticker-card${direction ? ` ticker-card--${direction}` : ''}${!clickable ? ' ticker-card--static' : ''}`}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <span className="ticker-card__symbol">{quote.displayName}</span>
      <div className="ticker-card__name-row">
        <span className="ticker-card__name">{quote.symbol}</span>
        {quote.price_source === 'prev_close' && (
          <span className="ticker-card__badge">prev. close</span>
        )}
      </div>
      <span className="ticker-card__price">{formatPrice(quote.price)}</span>
      <span className={`ticker-card__change ticker-card__change--${direction ?? 'neutral'}`}>
        {formatChange(quote.change, quote.changePct)}
      </span>
    </div>
  );
}

function TickerCardSkeleton() {
  return (
    <div className="ticker-card ticker-card--skeleton" aria-hidden="true">
      <div className="ticker-card__skel ticker-card__skel--symbol" />
      <div className="ticker-card__skel ticker-card__skel--name" />
      <div className="ticker-card__skel ticker-card__skel--price" />
      <div className="ticker-card__skel ticker-card__skel--change" />
    </div>
  );
}

function MarketNewsCard({ item }) {
  return (
    <div className="news-card">
      {item.image ? <img className="news-card__image" src={item.image} alt="" /> : null}
      <div className="news-card__body">
        <a
          className="news-card__headline"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.headline}
        </a>
        <span className="news-card__meta">
          {item.source} · {formatNewsDate(item.datetime)}
        </span>
      </div>
    </div>
  );
}

function NewsCardSkeleton() {
  return (
    <div className="news-card news-card--skeleton" aria-hidden="true">
      <div className="news-card__skel news-card__skel--image" />
      <div className="news-card__body">
        <div className="news-card__skel news-card__skel--headline" />
        <div className="news-card__skel news-card__skel--headline-2" />
        <div className="news-card__skel news-card__skel--meta" />
      </div>
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  const { quotes, loading: quotesLoading } = useMarketSnapshot();
  const { news, loading: newsLoading } = useMarketNews();

  const freshAt = quotes.find((q) => q.synced_at)?.synced_at;
  const freshnessLabel = formatSynced(freshAt);

  return (
    <PageLayout>
      <div className="home">
        <section className="home__snapshot">
          <div className="home__snapshot-header">
            <span className="home__section-label">Market Snapshot</span>
            {freshnessLabel && (
              <span className="home__freshness">Updated {freshnessLabel}</span>
            )}
          </div>
          <div className="home__snapshot-row">
            {quotesLoading
              ? Array.from({ length: 5 }, (_, i) => <TickerCardSkeleton key={i} />)
              : quotes.map((q) => (
                  <TickerCard
                    key={q.symbol}
                    quote={q}
                    onClick={STOCK_SYMBOLS.has(q.symbol) ? () => navigate(`/dashboard?symbol=${q.symbol}`) : undefined}
                  />
                ))}
          </div>
        </section>

        <section className="home__news">
          <span className="home__section-label">Market News</span>
          <div className="home__news-grid">
            {newsLoading
              ? Array.from({ length: 8 }, (_, i) => <NewsCardSkeleton key={i} />)
              : news.map((item) => <MarketNewsCard key={item.id} item={item} />)}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}

export default Home;
