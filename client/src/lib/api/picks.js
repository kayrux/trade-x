import { API_BASE_URL } from '../constants/index';

export async function fetchPicks({ channelId, symbol, sentiment, videoId } = {}) {
  const params = new URLSearchParams();
  if (channelId) params.set('channel_id', channelId);
  if (symbol) params.set('symbol', symbol);
  if (sentiment) params.set('sentiment', sentiment);
  if (videoId) params.set('video_id', videoId);

  const qs = params.toString();
  const res = await fetch(`${API_BASE_URL}/picks${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`Picks fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchChannels() {
  const res = await fetch(`${API_BASE_URL}/channels`);
  if (!res.ok) throw new Error(`Channels fetch failed: ${res.status}`);
  return res.json();
}

export async function addChannel({ youtube_channel_id, name }) {
  const res = await fetch(`${API_BASE_URL}/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ youtube_channel_id, name }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Add channel failed: ${res.status}`);
  }
  return res.json();
}

export async function processVideo(videoId) {
  const res = await fetch(`${API_BASE_URL}/channels/videos/${videoId}/process`, { method: 'POST' });
  if (!res.ok) throw new Error(`Process failed: ${res.status}`);
  return res.json(); // { status, picksCount, error }
}

export async function fetchVideoTranscript(videoId) {
  const res = await fetch(`${API_BASE_URL}/channels/videos/${videoId}/transcript`);
  if (!res.ok) throw new Error(`Transcript fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchSyncHistory({ channelId } = {}) {
  const params = new URLSearchParams();
  if (channelId) params.set('channel_id', channelId);
  const qs = params.toString();
  const res = await fetch(`${API_BASE_URL}/channels/videos${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(`Sync history fetch failed: ${res.status}`);
  return res.json();
}
