const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /picks?channel_id=&symbol=&sentiment=&video_id=
// Returns resolved picks with current performance data, newest first.
router.get('/', async (req, res) => {
  const { channel_id, symbol, sentiment, video_id } = req.query;

  const conditions = [`p.resolution_status = 'resolved'`];
  const params = [];

  if (channel_id) {
    params.push(channel_id);
    conditions.push(`tc.id = $${params.length}`);
  }
  if (symbol) {
    params.push(symbol.toUpperCase().trim());
    conditions.push(`s.symbol = $${params.length}`);
  }
  if (sentiment) {
    params.push(sentiment.toLowerCase());
    conditions.push(`p.sentiment = $${params.length}`);
  }
  if (video_id) {
    params.push(video_id);
    conditions.push(`v.id = $${params.length}`);
  }

  const where = conditions.join(' AND ');

  try {
    const { rows } = await pool.query(
      `SELECT
          p.id                        AS pick_id,
          tc.id                       AS channel_id,
          tc.name                     AS youtuber_name,
          v.youtube_video_id,
          v.title                     AS video_title,
          v.published_at,
          s.symbol,
          s.name                      AS company_name,
          p.sentiment,
          p.conviction,
          p.price_target,
          p.notes,
          v.general_summary,
          p.video_timestamp_seconds,
          p.price_at_mention,
          p.price_at_mention_source,
          q.last_price                AS current_price,
          CASE
            WHEN p.price_at_mention IS NOT NULL
             AND p.price_at_mention != 0
             AND q.last_price IS NOT NULL
            THEN ROUND(
              100.0 * (q.last_price - p.price_at_mention) / p.price_at_mention,
              2
            )
            ELSE NULL
          END                         AS pct_since_mention
       FROM picks p
       JOIN videos v            ON v.id = p.video_id
       JOIN tracked_channels tc ON tc.id = v.channel_id
       JOIN symbols s           ON s.id = p.symbol_id
       LEFT JOIN symbol_quotes q ON q.symbol_id = p.symbol_id
       WHERE ${where}
       ORDER BY v.published_at DESC`,
      params,
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
