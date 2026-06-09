import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, History } from 'lucide-react';
import PageLayout from '../../components/layouts/PageLayout/PageLayout';
import { useSyncHistory } from '../../hooks/useSyncHistory';
import { fetchChannels } from '../../lib/api/picks';
import './YouTuberPicks.css';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function StatusBadge({ status }) {
  const label = status === 'done' ? 'Done' : status === 'failed' ? 'Failed' : 'Pending';
  return <span className={`picks-badge sync-status--${status}`}>{label}</span>;
}

function SkeletonRows() {
  return Array.from({ length: 6 }, (_, i) => (
    <tr key={i} className="picks-table__row picks-table__row--skeleton">
      {Array.from({ length: 6 }, (_, j) => (
        <td key={j}><span className="picks-skeleton" /></td>
      ))}
    </tr>
  ));
}

export default function YouTuberPicks() {
  const navigate = useNavigate();
  const [channels, setChannels] = useState([]);
  const [channelFilter, setChannelFilter] = useState('');

  useEffect(() => {
    fetchChannels()
      .then(setChannels)
      .catch(() => {});
  }, []);

  const { videos, loading, error } = useSyncHistory({ channelId: channelFilter });

  function handleRowClick(v) {
    navigate(`/picks/video/${v.video_id}`, {
      state: { title: v.title, channelName: v.channel_name, youtubeVideoId: v.youtube_video_id },
    });
  }

  return (
    <PageLayout>
      <div className="picks-page">
        <div className="picks-page__header">
          <div>
            <h1 className="picks-page__title">YouTuber Picks</h1>
            <p className="picks-page__subtitle">
              Videos from tracked channels — click a row to see the stock picks.
            </p>
          </div>
          <button
            className="picks-history-btn"
            title="View sync history"
            onClick={() => navigate('/picks/sync-history')}
          >
            <History size={16} />
            <span>Sync History</span>
          </button>
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
        </div>

        {error && (
          <div className="picks-page__error">Failed to load videos: {error}</div>
        )}

        <div className="picks-table-wrapper">
          <table className="picks-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Channel</th>
                <th>Title</th>
                <th>Status</th>
                <th>Picks</th>
                <th>Resolved</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows />
              ) : videos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="picks-table__empty">
                    {error ? '' : 'No videos found. Add a channel to get started.'}
                  </td>
                </tr>
              ) : (
                videos.map((v) => (
                  <tr
                    key={v.video_id}
                    className="picks-table__row picks-table__row--clickable"
                    onClick={() => handleRowClick(v)}
                  >
                    <td className="picks-table__date">{formatDate(v.published_at)}</td>
                    <td className="picks-table__channel">{v.channel_name}</td>
                    <td>
                      <div className="sync-history__title-cell">
                        <span className="sync-history__video-title">{v.title || v.youtube_video_id}</span>
                        <a
                          className="picks-video-link"
                          href={`https://youtube.com/watch?v=${v.youtube_video_id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Open on YouTube"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    </td>
                    <td><StatusBadge status={v.status} /></td>
                    <td className="sync-history__count">{v.picks_count}</td>
                    <td className="sync-history__count sync-history__count--green">{v.resolved_count}</td>
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
