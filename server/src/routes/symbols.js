const express = require('express');
const axios = require('axios');
const pool = require('../db');

const router = express.Router();

const QUOTE_STALE_MS = 5 * 60 * 1000; // 5 minutes

// GET /symbols?q=AAP — prefix search, no quote data
router.get('/', async (req, res) => {
  const q = (req.query.q || '').toUpperCase().trim();
  if (!q) return res.json([]);

  try {
    const { rows } = await pool.query(
      `SELECT id, symbol, name, exchange
       FROM symbols
       WHERE symbol LIKE $1
       ORDER BY symbol
       LIMIT 20`,
      [`${q}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /symbols/:symbol — exact match with quote data
router.get('/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().trim();

  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.symbol, s.name, s.exchange,
              q.last_price, q.open, q.high, q.low, q.volume, q.synced_at
       FROM symbols s
       LEFT JOIN symbol_quotes q ON q.symbol_id = s.id
       WHERE s.symbol = $1`,
      [symbol]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Symbol not found' });

    const row = rows[0];
    const isStale = !row.synced_at || Date.now() - new Date(row.synced_at).getTime() > QUOTE_STALE_MS;

    if (isStale) {
      refreshQuote(row.id).catch(() => {});
    }

    res.json(row);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

async function refreshQuote(symbolId) {
  const { data } = await axios.get('https://finnhub.io/api/v1/quote', {
    params: { symbol: symbolId, token: process.env.FINNHUB_API_KEY },
  });

  await pool.query(
    `INSERT INTO symbol_quotes (symbol_id, last_price, open, high, low, volume, synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (symbol_id) DO UPDATE SET
       last_price = EXCLUDED.last_price,
       open       = EXCLUDED.open,
       high       = EXCLUDED.high,
       low        = EXCLUDED.low,
       volume     = EXCLUDED.volume,
       synced_at  = EXCLUDED.synced_at`,
    [symbolId, data.c, data.o, data.h, data.l, data.v]
  );
}

module.exports = router;
