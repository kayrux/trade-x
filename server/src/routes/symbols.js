const express = require("express");
const axios = require("axios");
const pool = require("../db");

const router = express.Router();

const QUOTE_STALE_MS = 5 * 60 * 1000; // 5 minutes
const PROFILE_STALE_MS = 24 * 60 * 60 * 1000; // 24 hours

// GET /symbols?q=AAP — prefix search by ticker or company name, no quote data
router.get("/", async (req, res) => {
  const raw = (req.query.q || "").trim();
  const q = raw.toUpperCase();
  if (!raw) return res.json([]);

  try {
    const { rows } = await pool.query(
      `SELECT id, symbol, name, exchange
       FROM symbols
       WHERE symbol LIKE $1 OR name ILIKE $2
       ORDER BY
         CASE WHEN symbol LIKE $1 THEN 0 ELSE 1 END,
         symbol
       LIMIT 20`,
      [`${q}%`, `${raw}%`],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// GET /symbols/:symbol — exact match with quote data, falls back to latest daily candle
router.get("/:symbol", async (req, res) => {
  const symbol = req.params.symbol.toUpperCase().trim();

  try {
    const { rows } = await pool.query(
      `SELECT s.id, s.symbol, s.name, s.exchange,
              q.last_price, q.open, q.high, q.low, q.volume, q.prev_close, q.synced_at,
              c.close AS candle_close, c.open AS candle_open, c.high AS candle_high,
              c.low AS candle_low, c.volume AS candle_volume, c.ts AS candle_ts,
              p.market_cap, p.industry, p.shares_outstanding, p.ipo_date, p.weburl,
              p.week52_high, p.week52_low, p.beta, p.synced_at AS profile_synced_at
       FROM symbols s
       LEFT JOIN symbol_quotes q ON q.symbol_id = s.id
       LEFT JOIN symbol_profiles p ON p.symbol_id = s.id
       LEFT JOIN LATERAL (
         SELECT close, open, high, low, volume, ts
         FROM symbol_candles
         WHERE symbol_id = s.id AND resolution = 'daily'
         ORDER BY ts DESC
         LIMIT 1
       ) c ON TRUE
       WHERE s.symbol = $1`,
      [symbol],
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "Symbol not found" });

    const row = rows[0];
    const isStale =
      !row.synced_at ||
      Date.now() - new Date(row.synced_at).getTime() > QUOTE_STALE_MS;

    if (isStale) {
      try {
        const fresh = await refreshQuote(row.id);
        row.last_price = fresh.last_price;
        row.open = fresh.open;
        row.high = fresh.high;
        row.low = fresh.low;
        row.volume = fresh.volume;
        row.prev_close = fresh.prev_close;
        row.synced_at = fresh.synced_at;
      } catch (err) {
        console.error("refreshQuote failed:", err.message);
      }
    }

    const profileStale =
      !row.profile_synced_at ||
      Date.now() - new Date(row.profile_synced_at).getTime() > PROFILE_STALE_MS;

    if (profileStale) {
      try {
        const freshProfile = await refreshProfile(row.id, row.symbol);
        Object.assign(row, freshProfile);
      } catch (err) {
        console.error("refreshProfile failed:", err.message);
      }
    }

    // Finnhub returns 0 for all fields when market is closed — treat 0 same as null
    const nz = (val) => (val != null && parseFloat(val) !== 0 ? val : null);
    const hasLiveQuote = nz(row.last_price) != null;

    res.json({
      id: row.id,
      symbol: row.symbol,
      name: row.name,
      exchange: row.exchange,
      last_price: nz(row.last_price) ?? row.candle_close,
      open: nz(row.open) ?? row.candle_open,
      high: nz(row.high) ?? row.candle_high,
      low: nz(row.low) ?? row.candle_low,
      volume: nz(row.volume) ?? row.candle_volume,
      prev_close: nz(row.prev_close),
      synced_at: hasLiveQuote ? row.synced_at : row.candle_ts,
      price_source: hasLiveQuote
        ? "live"
        : row.candle_close != null
          ? "historical"
          : null,
      market_cap: row.market_cap ?? null,
      industry: row.industry ?? null,
      shares_outstanding: row.shares_outstanding ?? null,
      ipo_date: row.ipo_date ?? null,
      weburl: row.weburl ?? null,
      week52_high: row.week52_high ?? null,
      week52_low: row.week52_low ?? null,
      beta: row.beta ?? null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

async function refreshQuote(symbolId) {
  const { data } = await axios.get("https://finnhub.io/api/v1/quote", {
    params: { symbol: symbolId, token: process.env.FINNHUB_API_KEY },
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

async function refreshProfile(symbolId, ticker) {
  const [profileRes, metricRes] = await Promise.all([
    axios.get("https://finnhub.io/api/v1/stock/profile2", {
      params: { symbol: ticker, token: process.env.FINNHUB_API_KEY },
    }),
    axios.get("https://finnhub.io/api/v1/stock/metric", {
      params: {
        symbol: ticker,
        metric: "all",
        token: process.env.FINNHUB_API_KEY,
      },
    }),
  ]);

  const p = profileRes.data;
  const m = metricRes.data?.metric ?? {};

  const profile = {
    market_cap: p.marketCapitalization ?? null,
    industry: p.finnhubIndustry ?? null,
    shares_outstanding: p.shareOutstanding ?? null,
    ipo_date: p.ipo ?? null,
    weburl: p.weburl ?? null,
    week52_high: m["52WeekHigh"] ?? null,
    week52_low: m["52WeekLow"] ?? null,
    beta: m.beta ?? null,
  };

  await pool.query(
    `INSERT INTO symbol_profiles
       (symbol_id, market_cap, industry, shares_outstanding, ipo_date, weburl, week52_high, week52_low, beta, synced_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
     ON CONFLICT (symbol_id) DO UPDATE SET
       market_cap         = EXCLUDED.market_cap,
       industry           = EXCLUDED.industry,
       shares_outstanding = EXCLUDED.shares_outstanding,
       ipo_date           = EXCLUDED.ipo_date,
       weburl             = EXCLUDED.weburl,
       week52_high        = EXCLUDED.week52_high,
       week52_low         = EXCLUDED.week52_low,
       beta               = EXCLUDED.beta,
       synced_at          = EXCLUDED.synced_at`,
    [
      symbolId,
      profile.market_cap,
      profile.industry,
      profile.shares_outstanding,
      profile.ipo_date,
      profile.weburl,
      profile.week52_high,
      profile.week52_low,
      profile.beta,
    ],
  );

  return profile;
}

module.exports = router;
