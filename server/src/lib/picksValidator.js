const axios = require('axios');
const pool = require('../db');

const CANDLE_SERVICE_URL = process.env.CANDLE_SERVICE_URL || 'http://localhost:5001';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Resolves a raw ticker + company name against the symbols table.
// Returns { symbolId, symbolTicker, resolutionStatus }
async function resolveSymbol(rawTicker, rawCompanyName) {
  const ticker = (rawTicker || '').toUpperCase().trim();
  if (!ticker) return { symbolId: null, symbolTicker: null, resolutionStatus: 'unmatched' };

  // Exact match first
  const exact = await pool.query(
    'SELECT id, symbol FROM symbols WHERE symbol = $1 LIMIT 1',
    [ticker],
  );
  if (exact.rows.length === 1) {
    return { symbolId: exact.rows[0].id, symbolTicker: exact.rows[0].symbol, resolutionStatus: 'resolved' };
  }

  // Prefix match — if exactly one result, accept it
  const prefix = await pool.query(
    "SELECT id, symbol FROM symbols WHERE symbol LIKE $1 || '%' LIMIT 2",
    [ticker],
  );
  if (prefix.rows.length === 1) {
    return { symbolId: prefix.rows[0].id, symbolTicker: prefix.rows[0].symbol, resolutionStatus: 'resolved' };
  }

  // No match or ambiguous
  const status = prefix.rows.length === 0 ? 'unmatched' : 'needs_review';
  return { symbolId: null, symbolTicker: null, resolutionStatus: status };
}

// Returns { price, source } for a resolved symbol at the time of the video.
// For recent videos (<24h), fetches a live Finnhub quote.
// For older videos, fetches a daily candle from the Python service.
async function getPriceAtMention(symbolTicker, publishedAt) {
  const publishedMs = publishedAt instanceof Date ? publishedAt.getTime() : new Date(publishedAt).getTime();
  const isRecent = Date.now() - publishedMs < ONE_DAY_MS;

  if (isRecent) {
    return fetchFinnhubQuote(symbolTicker);
  }
  return fetchCandlePrice(symbolTicker, publishedAt);
}

async function fetchFinnhubQuote(ticker) {
  try {
    const { data } = await axios.get('https://finnhub.io/api/v1/quote', {
      params: { symbol: ticker, token: process.env.FINNHUB_API_KEY },
      timeout: 10_000,
    });
    // Finnhub returns 0 for all fields when market is closed
    const price = data.c && data.c !== 0 ? data.c : (data.pc && data.pc !== 0 ? data.pc : null);
    if (price == null) return { price: null, source: 'unavailable' };
    return { price, source: 'quote_at_sync' };
  } catch {
    return { price: null, source: 'unavailable' };
  }
}

async function fetchCandlePrice(ticker, publishedAt) {
  try {
    const date = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
    const from = date.toISOString().split('T')[0];
    // Request 3 extra days forward in case the pick date falls on a weekend/holiday
    const toDate = new Date(date);
    toDate.setDate(toDate.getDate() + 3);
    const to = toDate.toISOString().split('T')[0];

    const { data } = await axios.get(`${CANDLE_SERVICE_URL}/candles`, {
      params: { symbol: ticker, from, to },
      timeout: 30_000,
    });

    const candles = data.candles || [];
    if (candles.length === 0) return { price: null, source: 'unavailable' };

    // Use the close of the nearest trading day at or after the pick date
    const price = parseFloat(candles[0].close);
    if (isNaN(price)) return { price: null, source: 'unavailable' };

    return { price, source: 'candle_backfill' };
  } catch {
    return { price: null, source: 'unavailable' };
  }
}

module.exports = { resolveSymbol, getPriceAtMention };
