import { useNews } from '../../../hooks/useNews';
import './CompanyNews.css';

function formatNewsDate(unixTs) {
  const date = new Date(unixTs * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function NewsItemSkeleton() {
  return (
    <div className="company-news__item company-news__item--skeleton">
      <div className="company-news__skeleton-headline" />
      <div className="company-news__skeleton-meta" />
    </div>
  );
}

function NewsItem({ item }) {
  return (
    <div className="company-news__item">
      {item.image && (
        <img
          className="company-news__image"
          src={item.image}
          alt=""
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <div className="company-news__text">
        <a
          className="company-news__headline"
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.headline}
        </a>
        <span className="company-news__meta">
          {item.source}
          {item.datetime ? ` · ${formatNewsDate(item.datetime)}` : ''}
        </span>
      </div>
    </div>
  );
}

function CompanyNews({ symbol }) {
  const { news, loading, error } = useNews(symbol);

  return (
    <div className="company-news">
      <p className="company-news__heading">Latest News</p>

      {loading && (
        <div className="company-news__list">
          <NewsItemSkeleton />
          <NewsItemSkeleton />
          <NewsItemSkeleton />
        </div>
      )}

      {!loading && error && (
        <p className="company-news__error">Could not load news.</p>
      )}

      {!loading && !error && news.length === 0 && (
        <p className="company-news__empty">No recent news found for {symbol}.</p>
      )}

      {!loading && !error && news.length > 0 && (
        <div className="company-news__list">
          {news.map((item) => (
            <NewsItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default CompanyNews;
