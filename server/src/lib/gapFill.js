const axios = require("axios");
const pool = require("../db");

const CANDLE_SERVICE_URL = process.env.CANDLE_SERVICE_URL || "http://localhost:5001";
const TARGET_YEARS_BACK = 10;
const BACKFILL_THRESHOLD_YEARS = 2;
const FRESH_DAYS = 4; // treat coverage as current if within this many days of last trading day

/**
 * Returns today minus N years as a Date.
 */
function yearsAgo(n) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d;
}

/**
 * Most recent weekday on or before today (heuristic — no holiday calendar).
 */
function lastTradingDay() {
  const d = new Date();
  const dow = d.getDay(); // 0=Sun, 6=Sat
  if (dow === 0) d.setDate(d.getDate() - 2);
  else if (dow === 6) d.setDate(d.getDate() - 1);
  return d;
}

function toDateStr(date) {
  return date.toISOString().split("T")[0];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/**
 * Fetch daily candles from the Python yfinance service.
 * Returns an array of { date, open, high, low, close, adjusted_close, volume }.
 * Returns [] on empty or pre-IPO window.
 */
async function fetchFromService(symbol, fromStr, toStr) {
  const { data } = await axios.get(`${CANDLE_SERVICE_URL}/candles`, {
    params: { symbol, from: fromStr, to: toStr },
    timeout: 120_000,
  });
  return data.candles || [];
}

/**
 * Bulk-upsert daily candles into symbol_candles.
 * Uses DO NOTHING to preserve existing rows.
 */
async function upsertCandles(symbolId, candles) {
  if (!candles.length) return;

  const tsList = candles.map((c) => `${c.date}T00:00:00Z`);
  const opens = candles.map((c) => c.open);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const closes = candles.map((c) => c.close);
  const adjCloses = candles.map((c) => c.adjusted_close ?? null);
  const volumes = candles.map((c) => c.volume);

  await pool.query(
    `INSERT INTO symbol_candles
       (symbol_id, resolution, ts, open, high, low, close, adjusted_close, volume, source, synced_at)
     SELECT $1, 'daily',
       UNNEST($2::timestamptz[]),
       UNNEST($3::decimal[]),
       UNNEST($4::decimal[]),
       UNNEST($5::decimal[]),
       UNNEST($6::decimal[]),
       UNNEST($7::decimal[]),
       UNNEST($8::bigint[]),
       'yfinance',
       NOW()
     ON CONFLICT (symbol_id, resolution, ts) DO NOTHING`,
    [symbolId, tsList, opens, highs, lows, closes, adjCloses, volumes],
  );
}

/**
 * Ensure per-symbol daily candle coverage is current, extending backward and
 * forward as needed.  Calls the Python yfinance service only for missing ranges.
 *
 * Algorithm:
 *   Case A — symbol never fetched (no candle_coverage row)
 *   Case B — coverage span < 2yr (or backfill not done) — extend backward to 10yr
 *     B1 — IPO date known and we already hold all data since IPO → mark done, no fetch
 *     B2 — fetch [effective_start, earliest_ts - 1] narrowed by IPO date if available
 *   Case C — forward gap (recent days missing) → top up
 *
 * @param {string} symbolId  Postgres symbol id (FIGI)
 * @param {string} symbol    Ticker string, e.g. "AAPL"
 */
async function ensureCoverage(symbolId, symbol) {
  const today = new Date();
  const targetStart = yearsAgo(TARGET_YEARS_BACK);
  const backfillThreshold = yearsAgo(BACKFILL_THRESHOLD_YEARS);
  const freshCutoff = new Date(lastTradingDay());
  freshCutoff.setDate(freshCutoff.getDate() - FRESH_DAYS);

  // Load current coverage and IPO date in parallel
  const [coverageResult, ipoResult] = await Promise.all([
    pool.query(
      "SELECT earliest_ts, latest_ts, backfill_done FROM candle_coverage WHERE symbol_id = $1",
      [symbolId],
    ),
    pool.query(
      "SELECT ipo_date FROM symbol_profiles WHERE symbol_id = $1",
      [symbolId],
    ),
  ]);

  const coverage = coverageResult.rows[0] || null;
  const ipoDate = ipoResult.rows[0]?.ipo_date
    ? new Date(ipoResult.rows[0].ipo_date)
    : null;

  // Effective start: use IPO date if it's more recent than the 10yr target
  function effectiveStart(fallback) {
    if (ipoDate && ipoDate > fallback) return ipoDate;
    return fallback;
  }

  // ── Case A: never fetched ──────────────────────────────────────────────────
  if (!coverage) {
    const start = effectiveStart(targetStart);
    const candles = await fetchFromService(symbol, toDateStr(start), toDateStr(today));
    await upsertCandles(symbolId, candles);

    const dates = candles.map((c) => c.date).sort();
    await pool.query(
      `INSERT INTO candle_coverage
         (symbol_id, earliest_ts, latest_ts, target_start, backfill_done, last_checked_at)
       VALUES ($1, $2, $3, $4, TRUE, NOW())
       ON CONFLICT (symbol_id) DO UPDATE
         SET earliest_ts     = EXCLUDED.earliest_ts,
             latest_ts       = EXCLUDED.latest_ts,
             backfill_done   = TRUE,
             last_checked_at = NOW()`,
      [
        symbolId,
        dates.length ? `${dates[0]}T00:00:00Z` : null,
        dates.length ? `${dates[dates.length - 1]}T00:00:00Z` : null,
        toDateStr(targetStart),
      ],
    );
    return;
  }

  let { earliest_ts, latest_ts, backfill_done } = coverage;
  let earliestTs = earliest_ts ? new Date(earliest_ts) : null;
  let latestTs = latest_ts ? new Date(latest_ts) : null;
  let needsCoverageUpdate = false;

  // ── Case B: coverage span < 2yr or backfill explicitly not done ───────────
  if (!backfill_done && earliestTs && earliestTs > backfillThreshold) {
    // B1: IPO date known and we already hold all data since IPO → short-circuit
    if (ipoDate && ipoDate >= earliestTs) {
      await pool.query(
        `UPDATE candle_coverage
         SET backfill_done = TRUE, last_checked_at = NOW()
         WHERE symbol_id = $1`,
        [symbolId],
      );
      backfill_done = true;
    } else {
      // B2: fetch the gap from effective_start to the day before our earliest row
      const start = effectiveStart(targetStart);
      const gapEnd = addDays(toDateStr(earliestTs), -1);
      const candles = await fetchFromService(symbol, toDateStr(start), gapEnd);
      await upsertCandles(symbolId, candles);

      if (candles.length) {
        const dates = candles.map((c) => c.date).sort();
        const newEarliest = new Date(`${dates[0]}T00:00:00Z`);
        if (!earliestTs || newEarliest < earliestTs) {
          earliestTs = newEarliest;
          needsCoverageUpdate = true;
        }
      }

      await pool.query(
        `UPDATE candle_coverage
         SET earliest_ts = $2, backfill_done = TRUE, last_checked_at = NOW()
         WHERE symbol_id = $1`,
        [symbolId, earliestTs ? earliestTs.toISOString() : null],
      );
      backfill_done = true;
    }
  }

  // ── Case C: forward gap ───────────────────────────────────────────────────
  if (!latestTs || latestTs < freshCutoff) {
    const gapStart = latestTs ? addDays(toDateStr(latestTs), 1) : toDateStr(targetStart);
    const candles = await fetchFromService(symbol, gapStart, toDateStr(today));
    await upsertCandles(symbolId, candles);

    if (candles.length) {
      const dates = candles.map((c) => c.date).sort();
      const newLatest = new Date(`${dates[dates.length - 1]}T00:00:00Z`);
      if (!latestTs || newLatest > latestTs) {
        latestTs = newLatest;
        needsCoverageUpdate = true;
      }
    }

    await pool.query(
      `UPDATE candle_coverage
       SET latest_ts = $2, last_checked_at = NOW()
       WHERE symbol_id = $1`,
      [symbolId, latestTs ? latestTs.toISOString() : null],
    );
  } else if (needsCoverageUpdate) {
    await pool.query(
      `UPDATE candle_coverage SET last_checked_at = NOW() WHERE symbol_id = $1`,
      [symbolId],
    );
  }
}

module.exports = { ensureCoverage };
