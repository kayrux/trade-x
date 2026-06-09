import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import { usePicks } from '../../hooks/usePicks';
import './YouTuberPicks.css';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatPrice(price) {
  if (price == null) return '—';
  return `$${parseFloat(price).toFixed(2)}`;
}

function videoLink(youtubeVideoId, timestampSeconds) {
  const base = `https://youtube.com/watch?v=${youtubeVideoId}`;
  return timestampSeconds ? `${base}&t=${timestampSeconds}` : base;
}

function SentimentBadge({ sentiment }) {
  if (!sentiment) return <span className="picks-badge picks-badge--neutral">—</span>;
  return (
    <span className={`picks-badge picks-badge--${sentiment.toLowerCase()}`}>
      {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
    </span>
  );
}

function PctChange({ value }) {
  if (value == null) return <span className="picks-pct picks-pct--null">—</span>;
  const sign = value >= 0 ? '+' : '';
  return (
    <span className={`picks-pct picks-pct--${value >= 0 ? 'positive' : 'negative'}`}>
      {sign}{value}%
    </span>
  );
}

function SkeletonRows() {
  return Array.from({ length: 4 }, (_, i) => (
    <tr key={i} className="picks-table__row picks-table__row--skeleton">
      {Array.from({ length: 7 }, (_, j) => (
        <td key={j}><span className="picks-skeleton" /></td>
      ))}
    </tr>
  ));
}

export default function VideoPicksDetail() {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const navState = location.state || {};
  const { picks, loading, error } = usePicks({ videoId });

  const firstPick = picks[0];
  const title = navState.title || firstPick?.video_title || 'Video';
  const channelName = navState.channelName || firstPick?.youtuber_name || '';
  const youtubeVideoId = navState.youtubeVideoId || firstPick?.youtube_video_id || '';
  const publishedAt = firstPick?.published_at;

  return (
    <PageLayout>
      <div className="picks-page">
        <button className="picks-back-btn" onClick={() => navigate('/picks')}>
          <ArrowLeft size={15} />
          Back to Picks
        </button>

        <div className="picks-video-detail-header">
          <div className="picks-video-detail-header__meta">
            {channelName && <span className="picks-video-detail-header__channel">{channelName}</span>}
            {publishedAt && <span className="picks-video-detail-header__date">{formatDate(publishedAt)}</span>}
          </div>
          <div className="picks-video-detail-header__title-row">
            <h1 className="picks-page__title">{title}</h1>
            {youtubeVideoId && (
              <a
                className="picks-video-link picks-video-link--large"
                href={`https://youtube.com/watch?v=${youtubeVideoId}`}
                target="_blank"
                rel="noreferrer"
                title="Watch on YouTube"
              >
                <ExternalLink size={18} />
              </a>
            )}
          </div>
        </div>

        {error && (
          <div className="picks-page__error">Failed to load picks: {error}</div>
        )}

        <div className="picks-table-wrapper">
          <table className="picks-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Sentiment</th>
                <th>Notes</th>
                <th>Price at Pick</th>
                <th>Current</th>
                <th>Return</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : picks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="picks-table__empty">
                    {error ? '' : 'No resolved picks found for this video.'}
                  </td>
                </tr>
              ) : (
                picks.map((pick) => (
                  <tr key={pick.pick_id} className="picks-table__row">
                    <td className="picks-table__symbol">
                      <div className="picks-symbol">
                        <span className="picks-symbol__ticker">{pick.symbol}</span>
                        <span className="picks-symbol__name">{pick.company_name}</span>
                      </div>
                    </td>
                    <td><SentimentBadge sentiment={pick.sentiment} /></td>
                    <td className="picks-table__notes">
                      <span className="picks-notes" title={pick.notes || ''}>
                        {pick.notes || '—'}
                      </span>
                    </td>
                    <td className="picks-table__price">{formatPrice(pick.price_at_mention)}</td>
                    <td className="picks-table__price">{formatPrice(pick.current_price)}</td>
                    <td>
                      <PctChange value={pick.pct_since_mention} />
                    </td>
                    <td>
                      <a
                        className="picks-video-link"
                        href={videoLink(pick.youtube_video_id, pick.video_timestamp_seconds)}
                        target="_blank"
                        rel="noreferrer"
                        title="Watch clip"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageLayout>
  );
}
