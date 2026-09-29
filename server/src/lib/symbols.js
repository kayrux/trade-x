const pool = require('../db');

// :id params reach Postgres as a uuid cast, so a non-uuid string would raise
// 22P02 and surface as a 500. Screen them out and treat them as "not found",
// which is also what a caller holding a stale client-side id should see.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Maps tickers to symbols.id, preserving the caller's order. Returns null when
// any ticker is unknown so the route can answer 400 rather than silently
// dropping it — the FK would reject it anyway.
//
// symbols.id is a FIGI, not the ticker, and a handful of tickers (TEVA, ARB, …)
// appear on two rows with different ids. DISTINCT ON makes the pick
// deterministic, so the same ticker always resolves to the same id and can't
// end up referenced twice under two ids.
async function resolveSymbolIds(tickers) {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (symbol) id, symbol
     FROM symbols
     WHERE symbol = ANY($1)
     ORDER BY symbol, id`,
    [tickers],
  );
  const byTicker = new Map(rows.map((r) => [r.symbol, r.id]));
  const ids = tickers.map((t) => byTicker.get(t));
  return ids.some((id) => id === undefined) ? null : ids;
}

module.exports = { UUID_RE, resolveSymbolIds };
