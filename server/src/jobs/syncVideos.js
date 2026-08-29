const pool = require('../db');
const { listNewVideos } = require('../lib/youtubeClient');
const { fetchTranscript, formatForLLM } = require('../lib/transcriptFetcher');
const { extractPicks } = require('../lib/geminiExtractor');
const { resolveSymbol, getPriceAtMention } = require('../lib/picksValidator');

// Pause between videos so we don't burst YouTube (transcript IP-blocking) or Gemini.
const THROTTLE_BETWEEN_VIDEOS_MS = 3000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
}

// Runs the full transcript → extraction → validation pipeline for one video.
async function runPipeline(video) {
  const transcript = await fetchTranscript(video.youtube_video_id);

  if (!transcript) {
    await pool.query(
      `UPDATE videos SET status = 'failed', transcript_status = 'no_captions', processed_at = NOW()
       WHERE id = $1`,
      [video.id],
    );
    return;
  }

  await pool.query(
    `UPDATE videos SET transcript_status = 'ok' WHERE id = $1`,
    [video.id],
  );

  const formatted = formatForLLM(transcript.segments);
  const { general_summary, mentions } = await extractPicks(formatted);

  for (const m of mentions) {
    const { symbolId, symbolTicker, resolutionStatus } = await resolveSymbol(
      m.ticker,
      m.company_name,
    );

    let priceAtMention = null;
    let priceAtMentionSource = 'unavailable';

    if (symbolTicker) {
      const priceResult = await getPriceAtMention(symbolTicker, video.published_at);
      priceAtMention = priceResult.price;
      priceAtMentionSource = priceResult.source;
    }

    await pool.query(
      `INSERT INTO picks
         (video_id, symbol_id, raw_ticker, raw_company_name, sentiment, conviction,
          price_target, notes, video_timestamp_seconds,
          price_at_mention, price_at_mention_source, resolution_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        video.id,
        symbolId,
        (m.ticker || '').toUpperCase().trim() || null,
        m.company_name || null,
        m.sentiment || null,
        m.conviction || null,
        m.price_target ?? null,
        m.notes || null,
        m.timestamp_seconds ?? null,
        priceAtMention,
        priceAtMentionSource,
        resolutionStatus,
      ],
    );
  }

  await pool.query(
    `UPDATE videos SET status = 'done', processed_at = NOW(), general_summary = $1 WHERE id = $2`,
    [general_summary, video.id],
  );
}

// Discovers and processes new videos for one channel.
// retryFailed re-attempts previously failed videos — MANUAL syncs only, so the
// automatic hourly cron never re-hammers YouTube (avoids transcript IP blocks).
async function processChannel(channel, sinceOverride = null, retryFailed = false) {
  const since = sinceOverride || (channel.last_checked_at ? new Date(channel.last_checked_at) : sevenDaysAgo());
  console.log(`[syncVideos] Checking channel "${channel.name}" since ${since.toISOString()}`);

  let newVideos;
  try {
    newVideos = await listNewVideos(channel.uploads_playlist_id, since);
  } catch (err) {
    console.error(`[syncVideos] listNewVideos failed for ${channel.name}:`, err.message);
    return;
  }

  console.log(`[syncVideos] Found ${newVideos.length} new video(s) for "${channel.name}"`);

  const videosToProcess = [];

  for (const v of newVideos) {
    const { rows } = await pool.query(
      `INSERT INTO videos (channel_id, youtube_video_id, title, published_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (youtube_video_id) DO NOTHING
       RETURNING id`,
      [channel.id, v.youtubeVideoId, v.title, v.publishedAt],
    );
    if (rows.length === 0) continue; // already in DB (not failed — skip)

    videosToProcess.push({
      id: rows[0].id,
      youtube_video_id: v.youtubeVideoId,
      published_at: v.publishedAt,
    });
  }

  // Retry previously failed videos — manual syncs only. The automatic cron skips
  // this so it never re-fetches transcripts in bulk and re-triggers an IP block.
  if (retryFailed) {
    const { rows: failedRows } = await pool.query(
      `SELECT id, youtube_video_id, published_at FROM videos
       WHERE channel_id = $1 AND status = 'failed'`,
      [channel.id],
    );

    if (failedRows.length > 0) {
      console.log(`[syncVideos] Retrying ${failedRows.length} failed video(s) for "${channel.name}"`);
      await pool.query(
        `UPDATE videos SET status = 'discovered', transcript_status = NULL, error_detail = NULL
         WHERE channel_id = $1 AND status = 'failed'`,
        [channel.id],
      );
      videosToProcess.push(...failedRows);
    }
  }

  for (let i = 0; i < videosToProcess.length; i++) {
    const video = videosToProcess[i];
    if (i > 0) await sleep(THROTTLE_BETWEEN_VIDEOS_MS);
    try {
      await runPipeline(video);
    } catch (err) {
      console.error(`[syncVideos] Pipeline failed for ${video.youtube_video_id}:`, err.message);
      await pool.query(
        `UPDATE videos SET status = 'failed', error_detail = $1, processed_at = NOW() WHERE id = $2`,
        [err.message, video.id],
      );
    }
  }

  await pool.query(
    `UPDATE tracked_channels SET last_checked_at = NOW() WHERE id = $1`,
    [channel.id],
  );
}

// Manual resync — forces a 7-day lookback regardless of last_checked_at.
async function resyncAllChannels(channelId = null) {
  const since = sevenDaysAgo();
  const query = channelId
    ? `SELECT * FROM tracked_channels WHERE is_active = TRUE AND id = $1`
    : `SELECT * FROM tracked_channels WHERE is_active = TRUE`;
  const { rows } = await pool.query(query, channelId ? [channelId] : []);
  for (const channel of rows) {
    await processChannel(channel, since, true); // manual → retry failed videos
  }
}

// Hourly cron target — processes all active channels.
async function syncAllChannels() {
  console.log('[syncVideos] Running hourly channel sync...');
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tracked_channels WHERE is_active = TRUE`,
    );
    for (const channel of rows) {
      await processChannel(channel);
    }
  } catch (err) {
    console.error('[syncVideos] syncAllChannels failed:', err.message);
  }
}

module.exports = { syncAllChannels, resyncAllChannels, processChannel, runPipeline };
