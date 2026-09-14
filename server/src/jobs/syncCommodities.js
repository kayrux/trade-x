const pool = require("../db");
const { AV_INSTRUMENTS, fetchDailySeries } = require("../lib/alphaVantage");

// Alpha Vantage free tier: ~1 request/second burst, 25 requests/day total.
// Space calls out, and skip the whole sync if data is already fresh so frequent
// dev restarts don't burn the daily budget.
const REQUEST_SPACING_MS = 1500;
const FRESH_MS = 20 * 60 * 60 * 1000; // 20h

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Upsert a daily single-value series into symbol_candles as flat OHLC.
 * open=high=low=close=value; adjusted_close is NULL; volume is 0 (the column is
 * NOT NULL and commodities have no share volume). Idempotent.
 */
async function upsertSeries(symbolId, series) {
  if (!series.length) return 0;
  const tsList = series.map((r) => `${r.date}T00:00:00Z`);
  const values = series.map((r) => r.value);

  await pool.query(
    `INSERT INTO symbol_candles
       (symbol_id, resolution, ts, open, high, low, close, adjusted_close, volume, source, synced_at)
     SELECT $1, 'daily', t.ts, t.v, t.v, t.v, t.v, NULL::decimal, 0::bigint, 'alphavantage', NOW()
     FROM UNNEST($2::timestamptz[], $3::decimal[]) AS t(ts, v)
     ON CONFLICT (symbol_id, resolution, ts) DO NOTHING`,
    [symbolId, tsList, values],
  );
  return series.length;
}

/**
 * True if we already synced Alpha Vantage commodity data recently.
 */
async function isFresh() {
  const { rows } = await pool.query(
    "SELECT MAX(synced_at) AS m FROM symbol_candles WHERE source = 'alphavantage'",
  );
  const m = rows[0] && rows[0].m;
  return !!m && Date.now() - new Date(m).getTime() < FRESH_MS;
}

/**
 * Fetch + upsert daily history for every tracked commodity.
 * @param {boolean} force  Skip the freshness guard (used by the daily cron).
 */
async function syncCommodities(force = false) {
  try {
    if (!force && (await isFresh())) {
      console.log("[commodities] recent Alpha Vantage data present — skipping sync.");
      return;
    }
  } catch (err) {
    console.error("[commodities] freshness check failed:", err.message);
  }

  const keys = Object.keys(AV_INSTRUMENTS);
  console.log(`[commodities] syncing ${keys.length} instruments from Alpha Vantage...`);
  for (const avKey of keys) {
    try {
      const series = await fetchDailySeries(avKey, { interval: "daily" });
      const n = await upsertSeries(avKey, series);
      const latest = series.length ? series[series.length - 1].date : "n/a";
      console.log(`[commodities] ${avKey}: ${n} rows processed (latest ${latest})`);
    } catch (err) {
      console.error(`[commodities] ${avKey} failed: ${err.message}`);
    }
    await sleep(REQUEST_SPACING_MS);
  }
  console.log("[commodities] sync complete.");
}

module.exports = syncCommodities;

// Allow running directly:  node src/jobs/syncCommodities.js [--force]
if (require.main === module) {
  require("dotenv").config();
  syncCommodities(process.argv.includes("--force"))
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
