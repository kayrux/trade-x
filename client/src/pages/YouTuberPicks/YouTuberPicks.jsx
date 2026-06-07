import { useState, useEffect } from 'react';
import { ExternalLink, ScrollText, Brain } from 'lucide-react';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import { usePicks } from '../../hooks/usePicks';
import { useSyncHistory } from '../../hooks/useSyncHistory';
import { fetchChannels, fetchVideoTranscript, processVideo } from '../../lib/api/picks';
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

function StatusBadge({ status }) {
  const label = status === 'done' ? 'Done' : status === 'failed' ? 'Failed' : 'Pending';
  return <span className={`picks-badge sync-status--${status}`}>{label}</span>;
}

function TranscriptBadge({ status }) {
  if (!status) return <span className="sync-transcript--none">—</span>;
  const label = status === 'ok' ? 'OK' : status === 'no_captions' ? 'No Captions' : 'Error';
  return <span className={`sync-transcript--${status}`}>{label}</span>;
}

function SyncSkeletonRows() {
  return Array.from({ length: 5 }, (_, i) => (
    <tr key={i} className="picks-table__row picks-table__row--skeleton">
      {Array.from({ length: 11 }, (_, j) => <td key={j}><span className="picks-skeleton" /></td>)}
    </tr>
  ));
}

function SkeletonRows() {
  return Array.from({ length: 6 }, (_, i) => (
    <tr key={i} className="picks-table__row picks-table__row--skeleton">
      {Array.from({ length: 8 }, (_, j) => (
        <td key={j}><span className="picks-skeleton" /></td>
      ))}
    </tr>
  ));
}

export default function YouTuberPicks() {
  const [channels, setChannels] = useState([]);
  const [channelFilter, setChannelFilter] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');

  useEffect(() => {
    fetchChannels()
      .then(setChannels)
      .catch(() => {});
  }, []);

  const { picks, loading, error, refresh: refreshPicks } = usePicks({
    channelId: channelFilter,
    sentiment: sentimentFilter,
  });

  const [geminiModal, setGeminiModal] = useState(null);
  const [geminiData, setGeminiData]   = useState({ loading: false, result: null, error: null });

  async function runProcess(videoId, title) {
    setGeminiModal({ videoId, title });
    setGeminiData({ loading: true, result: null, error: null });
    try {
      const result = await processVideo(videoId);
      setGeminiData({ loading: false, result, error: null });
      refreshSyncHistory();
      refreshPicks();
    } catch (err) {
      setGeminiData({ loading: false, result: null, error: err.message });
    }
  }

  const [transcriptModal, setTranscriptModal] = useState(null);
  const [transcriptData, setTranscriptData] = useState({ loading: false, text: null, available: null, segmentCount: null, error: null });

  function openTranscript(videoId, title) {
    setTranscriptModal({ videoId, title });
    setTranscriptData({ loading: true, text: null, available: null, segmentCount: null, error: null });
    fetchVideoTranscript(videoId)
      .then((d) => setTranscriptData({ loading: false, text: d.text, available: d.available, segmentCount: d.segmentCount, error: null }))
      .catch((err) => setTranscriptData({ loading: false, text: null, available: null, segmentCount: null, error: err.message }));
  }

  const { videos: syncVideos, loading: syncLoading, error: syncError, refresh: refreshSyncHistory } = useSyncHistory({
    channelId: channelFilter,
  });

  const totalVideos    = syncVideos.length;
  const doneCount      = syncVideos.filter(v => v.status === 'done').length;
  const failedCount    = syncVideos.filter(v => v.status === 'failed').length;
  const noCaptionCount = syncVideos.filter(v => v.transcript_status === 'no_captions').length;
  const successPct     = totalVideos ? Math.round((doneCount / totalVideos) * 100) : null;
  const noCaptionPct   = totalVideos ? Math.round((noCaptionCount / totalVideos) * 100) : null;
  const failedPct      = totalVideos ? Math.round((failedCount / totalVideos) * 100) : null;
  const lastSyncedAt   = channelFilter
    ? channels.find(c => c.id === channelFilter)?.last_checked_at
    : channels.reduce((latest, c) => (!latest || c.last_checked_at > latest) ? c.last_checked_at : latest, null);

  return (
    <PageLayout>
      <div className="picks-page">
        <div className="picks-page__header">
          <h1 className="picks-page__title">YouTuber Picks</h1>
          <p className="picks-page__subtitle">
            Stock mentions extracted from tracked channels — sorted by date, with performance since mention.
          </p>
        </div>

        <div className="picks-filters">
          <select
            className="picks-filters__select"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
          >
            <option value="">All Channels</option>
            {channels.map((ch) => (
              <option key={ch.id} value={ch.id}>{ch.name}</option>
            ))}
          </select>

          <select
            className="picks-filters__select"
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
          >
            <option value="">All Sentiments</option>
            <option value="bullish">Bullish</option>
            <option value="bearish">Bearish</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>

        {error && (
          <div className="picks-page__error">Failed to load picks: {error}</div>
        )}

        <div className="picks-table-wrapper">
          <table className="picks-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Channel</th>
                <th>Symbol</th>
                <th>Sentiment</th>
                <th>Notes</th>
                <th>Price at Pick</th>
                <th>Current</th>
                <th>Return</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : picks.length === 0 ? (
                <tr>
                  <td colSpan={8} className="picks-table__empty">
                    {error ? '' : 'No picks found. Add a channel to get started.'}
                  </td>
                </tr>
              ) : (
                picks.map((pick) => (
                  <tr key={pick.pick_id} className="picks-table__row">
                    <td className="picks-table__date">{formatDate(pick.published_at)}</td>
                    <td className="picks-table__channel">{pick.youtuber_name}</td>
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
                      <div className="picks-table__return">
                        <PctChange value={pick.pct_since_mention} />
                        <a
                          className="picks-video-link"
                          href={videoLink(pick.youtube_video_id, pick.video_timestamp_seconds)}
                          target="_blank"
                          rel="noreferrer"
                          title="Watch clip"
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="sync-history">
          <h2 className="sync-history__heading">Sync History</h2>
          <p className="sync-history__subtitle">
            Last 50 videos from the sync pipeline.{channelFilter ? ' Filtered to selected channel.' : ' All channels.'}
          </p>

          {!syncLoading && totalVideos > 0 && (
            <div className="sync-metrics">
              <div className="sync-metric">
                <span className="sync-metric__value">{totalVideos}</span>
                <span className="sync-metric__label">Videos</span>
              </div>
              <div className="sync-metric">
                <span className="sync-metric__value sync-metric__value--green">{successPct}%</span>
                <span className="sync-metric__label">Success</span>
              </div>
              <div className="sync-metric">
                <span className="sync-metric__value sync-metric__value--gray">{noCaptionPct}%</span>
                <span className="sync-metric__label">No Captions</span>
              </div>
              <div className="sync-metric">
                <span className="sync-metric__value sync-metric__value--red">{failedPct}%</span>
                <span className="sync-metric__label">Failed</span>
              </div>
              {lastSyncedAt && (
                <div className="sync-metric">
                  <span className="sync-metric__value sync-metric__value--muted">{formatDate(lastSyncedAt)}</span>
                  <span className="sync-metric__label">Last Synced</span>
                </div>
              )}
            </div>
          )}

          {syncError && <div className="picks-page__error">Failed to load sync history: {syncError}</div>}

          <div className="picks-table-wrapper">
            <table className="picks-table">
              <thead>
                <tr>
                  <th>Published</th>
                  <th>Channel</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Transcript</th>
                  <th>Picks</th>
                  <th>Resolved</th>
                  <th>Unmatched</th>
                  <th>Error</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {syncLoading ? (
                  <SyncSkeletonRows />
                ) : syncVideos.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="picks-table__empty">No videos found.</td>
                  </tr>
                ) : (
                  syncVideos.map((v) => (
                    <tr key={v.video_id} className="picks-table__row">
                      <td className="picks-table__date">{formatDate(v.published_at)}</td>
                      <td className="picks-table__channel">{v.channel_name}</td>
                      <td className="sync-history__title-cell">
                        <a
                          className="sync-history__video-link"
                          href={`https://youtube.com/watch?v=${v.youtube_video_id}`}
                          target="_blank"
                          rel="noreferrer"
                          title={v.title}
                        >
                          {v.title || v.youtube_video_id}
                        </a>
                      </td>
                      <td><StatusBadge status={v.status} /></td>
                      <td><TranscriptBadge status={v.transcript_status} /></td>
                      <td className="sync-history__count">{v.picks_count}</td>
                      <td className="sync-history__count sync-history__count--green">{v.resolved_count}</td>
                      <td className="sync-history__count sync-history__count--amber">{v.unmatched_count}</td>
                      <td className="sync-history__error" title={v.error_detail || ''}>
                        {v.error_detail
                          ? v.error_detail.slice(0, 60) + (v.error_detail.length > 60 ? '…' : '')
                          : <span className="sync-transcript--none">—</span>}
                      </td>
                      <td className="sync-history__actions">
                        <button
                          className="sync-transcript-btn"
                          title="View transcript"
                          onClick={() => openTranscript(v.video_id, v.title)}
                        >
                          <ScrollText size={14} />
                        </button>
                        <button
                          className="sync-transcript-btn"
                          title="Run pipeline & save picks"
                          onClick={() => runProcess(v.video_id, v.title)}
                        >
                          <Brain size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {geminiModal && (
        <div className="transcript-overlay" onClick={() => setGeminiModal(null)}>
          <div className="transcript-modal" onClick={(e) => e.stopPropagation()}>
            <div className="transcript-modal__header">
              <div className="transcript-modal__title-group">
                <h3 className="transcript-modal__title">{geminiModal.title}</h3>
              </div>
              <button className="transcript-modal__close" onClick={() => setGeminiModal(null)}>✕</button>
            </div>
            <div className="transcript-modal__body">
              {geminiData.loading && (
                <div className="transcript-modal__status">Running pipeline…</div>
              )}
              {!geminiData.loading && geminiData.error && (
                <div className="transcript-modal__status transcript-modal__status--error">
                  Request error: {geminiData.error}
                </div>
              )}
              {!geminiData.loading && geminiData.result && (
                <>
                  {geminiData.result.status === 'done' && (
                    <div className="transcript-modal__status transcript-modal__status--ok">
                      Done — {geminiData.result.picksCount} pick{geminiData.result.picksCount !== 1 ? 's' : ''} saved.
                    </div>
                  )}
                  {geminiData.result.status === 'failed' && (
                    <div className="extraction-result__error">
                      Pipeline failed: {geminiData.result.error}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {transcriptModal && (
        <div className="transcript-overlay" onClick={() => setTranscriptModal(null)}>
          <div className="transcript-modal" onClick={(e) => e.stopPropagation()}>
            <div className="transcript-modal__header">
              <div className="transcript-modal__title-group">
                <h3 className="transcript-modal__title">{transcriptModal.title}</h3>
                {!transcriptData.loading && transcriptData.available && (
                  <span className="transcript-modal__meta">{transcriptData.segmentCount} segments</span>
                )}
              </div>
              <button className="transcript-modal__close" onClick={() => setTranscriptModal(null)}>✕</button>
            </div>
            <div className="transcript-modal__body">
              {transcriptData.loading && (
                <div className="transcript-modal__status">Fetching transcript from YouTube…</div>
              )}
              {!transcriptData.loading && transcriptData.error && (
                <div className="transcript-modal__status transcript-modal__status--error">
                  Error: {transcriptData.error}
                </div>
              )}
              {!transcriptData.loading && transcriptData.available === false && (
                <div className="transcript-modal__status transcript-modal__status--empty">
                  No captions available for this video.
                </div>
              )}
              {!transcriptData.loading && transcriptData.available && !transcriptData.text && (
                <div className="transcript-modal__status transcript-modal__status--empty">
                  Transcript is empty.
                </div>
              )}
              {!transcriptData.loading && transcriptData.text && (
                <pre className="transcript-modal__text">{transcriptData.text}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
