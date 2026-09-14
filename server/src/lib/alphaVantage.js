const axios = require("axios");

const BASE_URL = "https://www.alphavantage.co/query";

// Commodity / precious-metal instruments we track, keyed by our synthetic
// (namespaced) symbol.  The "AV:" prefix keeps these from colliding with real
// Finnhub equity tickers — e.g. WTI (W&T Offshore) and GOLD (Barrick Gold) are
// live NYSE symbols in the `symbols` table.
//
// Alpha Vantage is function-dispatched: `fn` selects the operation, and
// GOLD_SILVER_HISTORY additionally needs `avSymbol`.
const AV_INSTRUMENTS = {
  "AV:WTI":    { fn: "WTI",                                displayName: "WTI Crude",   ticker: "WTI"    },
  "AV:BRENT":  { fn: "BRENT",                              displayName: "Brent Crude", ticker: "Brent"  },
  "AV:GOLD":   { fn: "GOLD_SILVER_HISTORY", avSymbol: "GOLD",   displayName: "Gold",   ticker: "Gold"   },
  "AV:SILVER": { fn: "GOLD_SILVER_HISTORY", avSymbol: "SILVER", displayName: "Silver", ticker: "Silver" },
};

// AV signals soft errors with HTTP 200 + one of these keys instead of data.
const SOFT_ERROR_KEYS = ["Note", "Information", "Error Message"];

/**
 * Fetch a daily price series for one tracked instrument from Alpha Vantage.
 * Returns [{ date: 'YYYY-MM-DD', value: Number }] sorted ascending (oldest first).
 *
 * WTI/BRENT respond as { name, interval, unit, data:[{date, value}] };
 * GOLD_SILVER_HISTORY responds as { nominal, data:[{date, price}] } — note the
 * value field is `price`, not `value`, so we accept either.
 *
 * Throws on AV soft-error responses (rate limit / invalid call) so the caller
 * can log and skip without corrupting stored data.
 */
async function fetchDailySeries(avKey, { interval = "daily" } = {}) {
  const inst = AV_INSTRUMENTS[avKey];
  if (!inst) throw new Error(`Unknown AV instrument: ${avKey}`);

  const params = { function: inst.fn, interval, apikey: process.env.ALPHA_API_KEY };
  if (inst.avSymbol) params.symbol = inst.avSymbol;

  const { data } = await axios.get(BASE_URL, { params, timeout: 30000 });

  for (const k of SOFT_ERROR_KEYS) {
    if (data && data[k]) throw new Error(`Alpha Vantage ${k}: ${data[k]}`);
  }

  const rows = Array.isArray(data && data.data) ? data.data : null;
  if (!rows) {
    throw new Error(
      `Alpha Vantage: unexpected response for ${avKey} (keys: ${Object.keys(data || {}).join(",")})`,
    );
  }

  return rows
    .map((r) => ({ date: r.date, value: Number(r.value ?? r.price) }))
    .filter((r) => r.date && Number.isFinite(r.value))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

module.exports = { AV_INSTRUMENTS, fetchDailySeries };
