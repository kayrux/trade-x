const express = require('express');
const pool = require('../db');
const { QUOTE_STALE_MS, isCommodity, refreshQuote } = require('../lib/quotes');
const { getPriceAtMention } = require('../lib/picksValidator');

const router = express.Router();

// Safety rail against the Finnhub 60-calls/min free tier. The per-video detail
// page only has a handful of symbols, so this is never hit in normal use.
const MAX_QUOTE_REFRESH = 25;

// GET /picks?channel_id=&symbol=&sentiment=&video_id=
// Returns resolved picks with current performance data, newest first.
// Before responding it opportunistically (a) refreshes stale current quotes and
// (b) backfills any missing price_at_mention, so revisiting the page shows fresh
// prices without relying on a scheduled quote-sync job.
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

  const sql = `SELECT
          p.id                        AS pick_id,
          tc.id                       AS channel_id,
          tc.name                     AS youtuber_name,
          v.youtube_video_id,
          v.title                     AS video_title,
          v.published_at,
          s.id                        AS symbol_id,
          s.symbol,
          s.name                      AS company_name,
          s.exchange,
          p.sentiment,
          p.conviction,
          p.price_target,
          p.notes,
          v.general_summary,
          p.video_timestamp_seconds,
          p.price_at_mention,
          p.price_at_mention_source,
          q.last_price                AS current_price,
          q.synced_at                 AS quote_synced_at,
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
       ORDER BY v.published_at DESC`;

  try {
    const { rows } = await pool.query(sql, params);

    // Refresh/backfill run best-effort: a Finnhub or candle-service outage must
    // still return the (stale) picks rather than a 500.
    let mutated = false;
    try {
      mutated = await refreshAndBackfill(rows);
    } catch (err) {
      console.error('picks refresh/backfill failed:', err.message);
    }

    if (!mutated) return res.json(rows);

    // Re-read so current_price, pct_since_mention, and any backfilled
    // price_at_mention reflect the freshly written rows.
    const { rows: freshRows } = await pool.query(sql, params);
    res.json(freshRows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Backfills missing price_at_mention and refreshes stale current quotes for the
// symbols in `rows`. Returns true if any DB row was written (so the caller
// re-queries).
async function refreshAndBackfill(rows) {
  let mutated = false;

  // (a) Backfill missing price_at_mention (one lookup per affected pick).
  const needsPrice = rows.filter(
    (r) => r.price_at_mention == null && r.symbol_id != null,
  );
  const backfillResults = await Promise.allSettled(
    needsPrice.map((r) => getPriceAtMention(r.symbol, r.published_at)),
  );
  for (let i = 0; i < needsPrice.length; i++) {
    const result = backfillResults[i];
    if (result.status !== 'fulfilled' || result.value.price == null) continue;
    await pool.query(
      `UPDATE picks SET price_at_mention = $1, price_at_mention_source = $2 WHERE id = $3`,
      [result.value.price, result.value.source, needsPrice[i].pick_id],
    );
    mutated = true;
  }

  // (b) Refresh stale current quotes for distinct non-commodity symbols.
  const now = Date.now();
  const stale = new Map(); // symbol_id -> symbol
  for (const r of rows) {
    if (r.symbol_id == null || isCommodity(r.symbol_id, r.exchange)) continue;
    const isStale =
      !r.quote_synced_at ||
      now - new Date(r.quote_synced_at).getTime() > QUOTE_STALE_MS;
    if (isStale) stale.set(r.symbol_id, r.symbol);
  }

  const toRefresh = Array.from(stale.entries()).slice(0, MAX_QUOTE_REFRESH);
  const refreshResults = await Promise.allSettled(
    toRefresh.map(([id, ticker]) => refreshQuote(id, ticker)),
  );
  if (refreshResults.some((r) => r.status === 'fulfilled')) mutated = true;

  return mutated;
}

module.exports = router;
