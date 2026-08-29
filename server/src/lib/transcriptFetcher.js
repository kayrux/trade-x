const axios = require('axios');

// Transcripts are fetched by the Python youtube-transcript-api service
// (same FastAPI app as the candle service — see gapFill.js).
const PYTHON_SERVICE_URL =
  process.env.PYTHON_SERVICE_URL ||
  process.env.CANDLE_SERVICE_URL ||
  'http://localhost:5001';

// Returns { text, segments } or null if captions are unavailable.
// segments: [{ text, offset, duration }] where offset/duration are in seconds.
async function fetchTranscript(youtubeVideoId) {
  let data;
  try {
    ({ data } = await axios.get(`${PYTHON_SERVICE_URL}/transcript`, {
      params: { video_id: youtubeVideoId },
      timeout: 60_000,
    }));
  } catch (err) {
    // Service down / timeout / 5xx — transient, must NOT be recorded as "no captions".
    console.error('[transcriptFetcher] transcript service error:', youtubeVideoId, err.message);
    throw new Error(`transcript service unreachable: ${err.message}`);
  }

  if (!data || !data.available || !data.segments?.length) {
    console.warn('[transcriptFetcher] no transcript:', youtubeVideoId, data?.reason || 'unknown');
    return null; // genuine no-captions
  }
  return { text: data.text, segments: data.segments };
}

// Formats transcript segments into a timestamped string for the LLM.
// Groups text into ~30-second blocks to reduce noise while preserving timestamps.
function formatForLLM(segments) {
  const lines = [];
  let blockText = '';
  let blockStart = 0;
  let lastBlockTime = -30;

  for (const seg of segments) {
    const t = Math.floor(seg.offset ?? 0);
    if (t - lastBlockTime >= 30) {
      if (blockText.trim()) lines.push(`[${formatTime(blockStart)}] ${blockText.trim()}`);
      blockText = '';
      blockStart = t;
      lastBlockTime = t;
    }
    blockText += (seg.text || '') + ' ';
  }
  if (blockText.trim()) lines.push(`[${formatTime(blockStart)}] ${blockText.trim()}`);

  return lines.join('\n');
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

module.exports = { fetchTranscript, formatForLLM };
