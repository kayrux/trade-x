const { YoutubeTranscript } = require('youtube-transcript');

// Returns { text, segments } or null if captions are unavailable.
// segments: [{ text, offset, duration }] where offset/duration are in seconds.
async function fetchTranscript(youtubeVideoId) {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(youtubeVideoId, { lang: 'en' });
    if (!segments || segments.length === 0) return null;

    const text = segments.map((s) => s.text).join(' ');
    return { text, segments };
  } catch {
    return null;
  }
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
