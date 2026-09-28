// Loaded before ../db, which builds its Pool from DATABASE_URL at require time.
// Under `npm start` index.js has already done this; a direct run has not.
if (require.main === module) require("dotenv").config();

const pool = require("../db");
const { isCommodity, refreshQuote } = require("../lib/quotes");

// Keeps symbol_quotes warm for symbols people actually watch. Without this the
// only writer is the single-symbol page route, so a sidebar row shows whatever
// price was stored the last time someone opened that symbol's page — which can
// be days old, with a stale prev_close making the % change wrong too.
//
// Scope is deliberately the watchlisted set, not all 31k symbols: Finnhub
// allows 60 calls/min, so the work has to stay bounded and predictable.

// Finnhub: 60 calls/min. Spacing plus the per-run cap keeps a single run inside
// its own tick with room to spare for the page route's own live refreshes.
const REQUEST_SPACING_MS = 1100;
const MAX_SYMBOLS_PER_RUN = 40;

// Don't re-fetch what a page view just refreshed.
const FRESH_MS = 90 * 1000;

// US regular session, in America/New_York. Quotes barely move outside it, and
// the run just after the close captures the final print.
const MARKET_OPEN_MINUTES = 9 * 60 + 30;
const MARKET_CLOSE_MINUTES = 16 * 60 + 5;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A run can outlive its tick if Finnhub is slow; overlapping runs would double
// the call rate, so a second one steps aside.
let running = false;

/**
 * True during the US regular session, Mon-Fri, read in New York time so it
 * follows daylight saving without a timezone library.
 *
 * Market holidays are not accounted for — a holiday costs a few wasted calls
 * returning the previous close, which is harmless.
 */
function isMarketHours(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekday = get("weekday");
  if (weekday === "Sat" || weekday === "Sun") return false;

  // "24" appears at midnight in some ICU versions; normalise it to 0.
  const minutes = (Number(get("hour")) % 24) * 60 + Number(get("minute"));
  return minutes >= MARKET_OPEN_MINUTES && minutes <= MARKET_CLOSE_MINUTES;
}

/**
 * Symbols on at least one watchlist whose stored quote is stale, oldest first
 * so a list longer than the per-run cap still gets fully refreshed over
 * consecutive runs rather than starving its tail.
 */
async function staleWatchlistedSymbols() {
  const { rows } = await pool.query(
    `SELECT DISTINCT s.id, s.symbol, s.exchange, q.synced_at
     FROM watchlist_symbols ws
     JOIN symbols s ON s.id = ws.symbol_id
     LEFT JOIN symbol_quotes q ON q.symbol_id = s.id
     WHERE q.synced_at IS NULL OR q.synced_at < NOW() - ($1::int * INTERVAL '1 millisecond')
     ORDER BY q.synced_at NULLS FIRST
     LIMIT $2`,
    [FRESH_MS, MAX_SYMBOLS_PER_RUN],
  );
  // Commodities have no Finnhub quote; they're served from stored candles.
  return rows.filter((r) => !isCommodity(r.id, r.exchange));
}

/**
 * Refresh stored quotes for watchlisted symbols.
 * @param {boolean} force  Run outside market hours (used by the CLI entry point).
 */
async function syncQuotes(force = false) {
  if (!force && !isMarketHours()) return;

  if (running) {
    console.log("[quotes] previous run still in flight — skipping this tick.");
    return;
  }
  running = true;

  try {
    const symbols = await staleWatchlistedSymbols();
    if (symbols.length === 0) return;

    let refreshed = 0;
    for (const row of symbols) {
      try {
        await refreshQuote(row.id, row.symbol);
        refreshed += 1;
      } catch (err) {
        console.error(`[quotes] ${row.symbol} failed: ${err.message}`);
      }
      await sleep(REQUEST_SPACING_MS);
    }
    console.log(`[quotes] refreshed ${refreshed}/${symbols.length} watchlisted symbols.`);
  } catch (err) {
    console.error("[quotes] sync failed:", err.message);
  } finally {
    running = false;
  }
}

module.exports = syncQuotes;
module.exports.isMarketHours = isMarketHours;

// Allow running directly:  node src/jobs/syncQuotes.js [--force]
if (require.main === module) {
  syncQuotes(process.argv.includes("--force"))
    .then(() => pool.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
