const express = require('express');
const pool = require('../db');
const { resolveUploadsPlaylistId } = require('../lib/youtubeClient');
const { processChannel, runPipeline } = require('../jobs/syncVideos');
const { fetchTranscript, formatForLLM } = require('../lib/transcriptFetcher');
const { extractPicksDebug } = require('../lib/geminiExtractor');

const router = express.Router();

// POST /channels — add a new tracked channel and kick off a 7-day backfill
router.post('/', async (req, res) => {
  const { youtube_channel_id, name } = req.body;
  if (!youtube_channel_id || !name) {
    return res.status(400).json({ error: 'youtube_channel_id and name are required' });
  }

  let uploadsPlaylistId;
  try {
    uploadsPlaylistId = await resolveUploadsPlaylistId(youtube_channel_id);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  let channel;
  try {
    const { rows } = await pool.query(
      `INSERT INTO tracked_channels (youtube_channel_id, uploads_playlist_id, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (youtube_channel_id) DO UPDATE SET
         uploads_playlist_id = EXCLUDED.uploads_playlist_id,
         name                = EXCLUDED.name,
         is_active           = TRUE,
         last_checked_at     = NULL
       RETURNING *`,
      [youtube_channel_id, uploadsPlaylistId, name],
    );
    channel = rows[0];
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error' });
  }

  // Fire-and-forget backfill (last_checked_at is null → defaults to 7 days ago in processChannel)
  setImmediate(() =>
    processChannel(channel).catch((err) =>
      console.error(`[channels] Backfill failed for ${channel.name}:`, err.message),
    ),
  );

  res.status(201).json(channel);
});

// POST /channels/videos/:id/process — run the full pipeline for one video on demand
router.post('/videos/:id/process', async (req, res) => {
  let video;
  try {
    const { rows } = await pool.query(
      `SELECT id, youtube_video_id, published_at FROM videos WHERE id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Video not found' });
    video = rows[0];
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error' });
  }

  // Clear stale picks so re-run doesn't create duplicates
  await pool.query(`DELETE FROM picks WHERE video_id = $1`, [video.id]);

  // Reset video so runPipeline treats it as fresh
  await pool.query(
    `UPDATE videos SET status = 'discovered', transcript_status = NULL,
     error_detail = NULL, processed_at = NULL WHERE id = $1`,
    [video.id],
  );

  try {
    await runPipeline(video);
  } catch (err) {
    return res.json({ status: 'failed', picksCount: 0, error: err.message });
  }

  const { rows: pickRows } = await pool.query(
    `SELECT COUNT(*) AS count FROM picks WHERE video_id = $1`,
    [video.id],
  );
  res.json({ status: 'done', picksCount: Number(pickRows[0].count), error: null });
});

// GET /channels/videos/:id/extract-debug — run Gemini extraction live and return raw response
router.get('/videos/:id/extract-debug', async (req, res) => {
  let youtubeVideoId;
  try {
    const { rows } = await pool.query(
      `SELECT youtube_video_id FROM videos WHERE id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Video not found' });
    youtubeVideoId = rows[0].youtube_video_id;
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error' });
  }

  const transcript = await fetchTranscript(youtubeVideoId);
  if (!transcript) {
    return res.json({ transcriptAvailable: false, gemini: null });
  }

  const formatted = formatForLLM(transcript.segments);
  const gemini = await extractPicksDebug(formatted);

  res.json({
    transcriptAvailable: true,
    segmentCount: transcript.segments.length,
    formattedLength: formatted.length,
    gemini,
  });
});

// GET /channels/videos/:id/transcript — fetch live transcript for a video (debugging)
router.get('/videos/:id/transcript', async (req, res) => {
  let youtubeVideoId;
  try {
    const { rows } = await pool.query(
      `SELECT youtube_video_id FROM videos WHERE id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Video not found' });
    youtubeVideoId = rows[0].youtube_video_id;
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Database error' });
  }

  const transcript = await fetchTranscript(youtubeVideoId);
  if (!transcript) {
    return res.json({ available: false, text: null, segmentCount: 0 });
  }

  res.json({
    available: true,
    text: formatForLLM(transcript.segments),
    segmentCount: transcript.segments.length,
  });
});

// GET /channels/videos?channel_id= — sync history for debugging
router.get('/videos', async (req, res) => {
  const { channel_id } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT
          v.id                                                              AS video_id,
          v.youtube_video_id,
          v.title,
          v.published_at,
          v.status,
          v.transcript_status,
          v.error_detail,
          v.processed_at,
          tc.id                                                             AS channel_id,
          tc.name                                                           AS channel_name,
          COUNT(p.id)                                                       AS picks_count,
          COUNT(p.id) FILTER (WHERE p.resolution_status = 'resolved')      AS resolved_count,
          COUNT(p.id) FILTER (WHERE p.resolution_status = 'unmatched')     AS unmatched_count,
          COALESCE(
            JSON_AGG(
              JSON_BUILD_OBJECT(
                'ticker',  COALESCE(p.raw_ticker, '?'),
                'company', p.raw_company_name,
                'status',  p.resolution_status
              )
              ORDER BY p.raw_ticker
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'::json
          )                                                                 AS picks_list
       FROM videos v
       JOIN  tracked_channels tc ON tc.id = v.channel_id
       LEFT JOIN picks p         ON p.video_id = v.id
       WHERE ($1::uuid IS NULL OR tc.id = $1::uuid)
       GROUP BY v.id, tc.id
       ORDER BY v.published_at DESC
       LIMIT 50`,
      [channel_id || null],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /channels — list all tracked channels
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM tracked_channels ORDER BY name`,
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /channels/:id — deactivate a channel (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await pool.query(
      `UPDATE tracked_channels SET is_active = FALSE WHERE id = $1`,
      [req.params.id],
    );
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
