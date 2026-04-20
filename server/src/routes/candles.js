const express = require('express');
const axios = require('axios');
const pool = require('../db');

const router = express.Router();

const VALID_RESOLUTIONS = ['daily', 'weekly', 'monthly'];
const STALE_MS = { daily: 24 * 60 * 60 * 1000, weekly: 24 * 60 * 60 * 1000, monthly: 24 * 60 * 60 * 1000 };
const DAILY_YEARS_BACK = 5;
const EODHD_BASE = 'https://eodhd.com/api';

// GET /candles/:symbol?resolution=daily&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().trim();
  const resolution = (req.query.resolution || 'daily').toLowerCase();

  if (!VALID_RESOLUTIONS.includes(resolution)) {
    return res.status(400).json({ error: `Invalid resolution. Must be one of: ${VALID_RESOLUTIONS.join(', ')}` });
  }

  try {
    // Validate symbol exists
    const { rows: symRows } = await pool.query(
      'SELECT id FROM symbols WHERE symbol = $1',
      [symbol]
    );
    if (symRows.length === 0) return res.status(404).json({ error: 'Symbol not found' });
    const symbolId = symRows[0].id;

    // Check staleness via meta table
    const { rows: metaRows } = await pool.query(
      'SELECT fetched_at FROM symbol_candle_meta WHERE symbol_id = $1 AND resolution = $2',
      [symbolId, resolution]
    );

    const isStale =
      metaRows.length === 0 ||
      Date.now() - new Date(metaRows[0].fetched_at).getTime() > STALE_MS[resolution];

    if (isStale) {
      refreshCandles(symbolId, symbol, resolution).catch((err) =>
        console.error(`refreshCandles failed for ${symbol}/${resolution}:`, err.message)
      );
    }

    // Parse optional from/to query params
    const from = req.query.from || null;
    const to = req.query.to || null;

    let query = `
      SELECT ts, open, high, low, close, adjusted_close, volume
      FROM symbol_candles
      WHERE symbol_id = $1 AND resolution = $2
    `;
    const params = [symbolId, resolution];

    if (from) { params.push(from); query += ` AND ts >= $${params.length}`; }
    if (to)   { params.push(to);   query += ` AND ts <= $${params.length}`; }

    query += ' ORDER BY ts ASC';

    const { rows } = await pool.query(query, params);
    res.json({ symbol, resolution, candles: rows });
  } catch (err) {
    console.error('candles route error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

async function refreshCandles(symbolId, symbol, resolution) {
  const apiKey = process.env.EODHD_API_KEY;

  const period = resolution === 'daily' ? 'd' : resolution === 'weekly' ? 'w' : 'm';
  const candles = await fetchEod(symbol, period, apiKey);

  if (!candles.length) return;

  // Build parallel arrays for unnest bulk upsert
  const tsList   = candles.map(c => c.ts);
  const opens    = candles.map(c => c.open);
  const highs    = candles.map(c => c.high);
  const lows     = candles.map(c => c.low);
  const closes   = candles.map(c => c.close);
  const adjClose = candles.map(c => c.adjusted_close ?? null);
  const volumes  = candles.map(c => c.volume);

  await pool.query(
    `INSERT INTO symbol_candles
       (symbol_id, resolution, ts, open, high, low, close, adjusted_close, volume, synced_at)
     SELECT $1, $2,
       UNNEST($3::timestamptz[]), UNNEST($4::decimal[]), UNNEST($5::decimal[]),
       UNNEST($6::decimal[]), UNNEST($7::decimal[]), UNNEST($8::decimal[]),
       UNNEST($9::bigint[]), NOW()
     ON CONFLICT (symbol_id, resolution, ts) DO UPDATE SET
       open           = EXCLUDED.open,
       high           = EXCLUDED.high,
       low            = EXCLUDED.low,
       close          = EXCLUDED.close,
       adjusted_close = EXCLUDED.adjusted_close,
       volume         = EXCLUDED.volume,
       synced_at      = EXCLUDED.synced_at`,
    [symbolId, resolution, tsList, opens, highs, lows, closes, adjClose, volumes]
  );

  const sortedTs = tsList.slice().sort();
  await pool.query(
    `INSERT INTO symbol_candle_meta (symbol_id, resolution, first_ts, last_ts, fetched_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (symbol_id, resolution) DO UPDATE SET
       first_ts   = LEAST(symbol_candle_meta.first_ts, EXCLUDED.first_ts),
       last_ts    = GREATEST(symbol_candle_meta.last_ts, EXCLUDED.last_ts),
       fetched_at = NOW()`,
    [symbolId, resolution, sortedTs[0], sortedTs[sortedTs.length - 1]]
  );
}

async function fetchEod(symbol, period, apiKey) {
  const from = new Date();
  from.setFullYear(from.getFullYear() - DAILY_YEARS_BACK);
  const fromStr = from.toISOString().split('T')[0];

  const { data } = await axios.get(`${EODHD_BASE}/eod/${symbol}.US`, {
    params: { api_token: apiKey, period, from: fromStr, fmt: 'json' },
  });

  return data.map(row => ({
    ts:             `${row.date}T00:00:00Z`,
    open:           row.open,
    high:           row.high,
    low:            row.low,
    close:          row.close,
    adjusted_close: row.adjusted_close ?? null,
    volume:         row.volume,
  }));
}


module.exports = router;
