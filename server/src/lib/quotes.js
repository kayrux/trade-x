const axios = require('axios');
const pool = require('../db');

const QUOTE_STALE_MS = 30 * 1000; // 30 seconds

// Commodities (Alpha Vantage) have no Finnhub quote — they use AV: pseudo-ids
// and the COMMODITY exchange, and must never be sent to Finnhub /quote.
function isCommodity(id, exchange) {
  return exchange === 'COMMODITY' || String(id).startsWith('AV:');
}

// Fetches a live Finnhub quote and upserts it into symbol_quotes.
async function refreshQuote(symbolId, ticker) {
  const { data } = await axios.get('https://finnhub.io/api/v1/quote', {
    params: { symbol: ticker, token: process.env.FINNHUB_API_KEY },
  });

  const synced_at = new Date();
  await pool.query(
    `INSERT INTO symbol_quotes (symbol_id, last_price, open, high, low, volume, prev_close, synced_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (symbol_id) DO UPDATE SET
       last_price = EXCLUDED.last_price,
       open       = EXCLUDED.open,
       high       = EXCLUDED.high,
       low        = EXCLUDED.low,
       volume     = EXCLUDED.volume,
       prev_close = EXCLUDED.prev_close,
       synced_at  = EXCLUDED.synced_at`,
    [symbolId, data.c, data.o, data.h, data.l, data.v, data.pc],
  );

  return {
    last_price: data.c,
    open: data.o,
    high: data.h,
    low: data.l,
    volume: data.v,
    prev_close: data.pc,
    synced_at,
  };
}

module.exports = { QUOTE_STALE_MS, isCommodity, refreshQuote };
