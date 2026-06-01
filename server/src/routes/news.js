const express = require('express');
const axios = require('axios');
const pool = require('../db');

const router = express.Router();

const FINNHUB_BASE = 'https://finnhub.io/api/v1';
const CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_ITEMS = 20;
const DAYS_BACK = 30;

const cache = new Map();

function toDateStr(date) {
  return date.toISOString().split('T')[0];
}

// GET /news/:symbol
router.get('/:symbol', async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().trim();

  try {
    const { rows } = await pool.query(
      'SELECT id FROM symbols WHERE symbol = $1',
      [symbol],
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Symbol not found' });
    }

    const cached = cache.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return res.json({ symbol, news: cached.data });
    }

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - DAYS_BACK);

    const { data } = await axios.get(`${FINNHUB_BASE}/company-news`, {
      params: {
        symbol,
        from: toDateStr(from),
        to: toDateStr(to),
        token: process.env.FINNHUB_API_KEY,
      },
    });

    const news = Array.isArray(data)
      ? data
          .sort((a, b) => b.datetime - a.datetime)
          .slice(0, MAX_ITEMS)
          .map(({ id, headline, summary, url, source, datetime, image, category }) => ({
            id,
            headline,
            summary,
            url,
            source,
            datetime,
            image,
            category,
          }))
      : [];

    cache.set(symbol, { data: news, fetchedAt: Date.now() });

    res.json({ symbol, news });
  } catch (err) {
    console.error('news route error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
