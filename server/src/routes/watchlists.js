const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Postgres unique_violation — see idx_watchlists_user_name_lower in 006_watchlists.sql.
const UNIQUE_VIOLATION = '23505';

const DEFAULT_NAME = 'New Watchlist';
const MAX_NAME_LENGTH = 60;
const MAX_SYMBOLS_PER_LIST = 100;

// :id params reach Postgres as a uuid cast, so a non-uuid string would raise
// 22P02 and surface as a 500. Screen them out and treat them as "not found",
// which is also what a caller holding a stale client-side id should see.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every handler returns watchlists in this shape: symbols is an ordered array of
// plain tickers, aggregated in SQL so one round trip serves the whole sidebar.
// The `$2 IS NULL` branch lets this serve both the list and the single-row reads.
async function selectWatchlists(userId, watchlistId = null) {
  const { rows } = await pool.query(
    `SELECT w.id, w.name, w.is_public, w.created_at,
            COALESCE(
              ARRAY_AGG(s.symbol ORDER BY ws.position) FILTER (WHERE s.symbol IS NOT NULL),
              '{}'
            ) AS symbols
     FROM watchlists w
     LEFT JOIN watchlist_symbols ws ON ws.watchlist_id = w.id
     LEFT JOIN symbols s            ON s.id = ws.symbol_id
     WHERE w.user_id = $1
       AND ($2::uuid IS NULL OR w.id = $2::uuid)
     GROUP BY w.id
     ORDER BY w.created_at`,
    [userId, watchlistId],
  );
  return rows;
}

// Ownership gate for every :id route. Returns the watchlist or null — a missing
// row and someone else's row are indistinguishable on purpose, so a 404 can't be
// used to probe which ids exist.
async function findOwned(userId, watchlistId) {
  if (!UUID_RE.test(watchlistId)) return null;
  const rows = await selectWatchlists(userId, watchlistId);
  return rows[0] || null;
}

function validateName(raw) {
  if (!raw) return null; // callers decide whether blank is a 400 or the default
  if (raw.length > MAX_NAME_LENGTH) {
    return `Watchlist name must be ${MAX_NAME_LENGTH} characters or fewer`;
  }
  return null;
}

// Maps tickers to symbols.id, preserving the caller's order. Returns null when
// any ticker is unknown so the route can answer 400 rather than silently
// dropping it — the FK would reject it anyway.
//
// symbols.id is a FIGI, not the ticker, and a handful of tickers (TEVA, ARB, …)
// appear on two rows with different ids. DISTINCT ON makes the pick
// deterministic, so the same ticker always resolves to the same id and can't
// end up on one watchlist twice under two ids.
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

// GET /watchlists — every list owned by the caller, symbols in display order
router.get('/', requireAuth, async (req, res) => {
  try {
    res.json(await selectWatchlists(req.user.id));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /watchlists — a blank name falls back to 'New Watchlist'
router.post('/', requireAuth, async (req, res) => {
  const name = (req.body.name || '').trim() || DEFAULT_NAME;

  const invalid = validateName(name);
  if (invalid) return res.status(400).json({ error: invalid });

  try {
    const { rows } = await pool.query(
      `INSERT INTO watchlists (user_id, name) VALUES ($1, $2) RETURNING id`,
      [req.user.id, name],
    );
    const [watchlist] = await selectWatchlists(req.user.id, rows[0].id);
    res.status(201).json(watchlist);
  } catch (err) {
    // Let the unique index arbitrate rather than checking first, which would
    // race between the SELECT and the INSERT.
    if (err.code === UNIQUE_VIOLATION) {
      return res
        .status(400)
        .json({ error: 'You already have a watchlist with that name' });
    }
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH /watchlists/:id — rename
router.patch('/:id', requireAuth, async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });

  const invalid = validateName(name);
  if (invalid) return res.status(400).json({ error: invalid });

  try {
    if (!(await findOwned(req.user.id, req.params.id))) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }

    await pool.query(
      `UPDATE watchlists SET name = $1 WHERE id = $2 AND user_id = $3`,
      [name, req.params.id, req.user.id],
    );
    const [watchlist] = await selectWatchlists(req.user.id, req.params.id);
    res.json(watchlist);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      return res
        .status(400)
        .json({ error: 'You already have a watchlist with that name' });
    }
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /watchlists/:id — the symbol rows go with it via ON DELETE CASCADE
router.delete('/:id', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(404).json({ error: 'Watchlist not found' });
  }

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM watchlists WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Watchlist not found' });
    }
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /watchlists/:id/symbols — append one ticker. Idempotent: re-adding a
// symbol already on the list succeeds without moving or duplicating it.
router.post('/:id/symbols', requireAuth, async (req, res) => {
  const symbol = String(req.body.symbol || '').toUpperCase().trim();
  if (!symbol) return res.status(400).json({ error: 'symbol is required' });

  try {
    const watchlist = await findOwned(req.user.id, req.params.id);
    if (!watchlist) return res.status(404).json({ error: 'Watchlist not found' });

    // Already on the list — answer with the list unchanged rather than relying
    // on the PK conflict, which only catches a repeat of the *same* id.
    if (watchlist.symbols.includes(symbol)) {
      return res.json(watchlist);
    }

    if (watchlist.symbols.length >= MAX_SYMBOLS_PER_LIST) {
      return res
        .status(400)
        .json({ error: `A watchlist can hold at most ${MAX_SYMBOLS_PER_LIST} symbols` });
    }

    const ids = await resolveSymbolIds([symbol]);
    if (!ids) return res.status(400).json({ error: 'Unknown symbol' });

    await pool.query(
      `INSERT INTO watchlist_symbols (watchlist_id, symbol_id, position)
       SELECT $1, $2,
              COALESCE((SELECT MAX(position) + 1 FROM watchlist_symbols WHERE watchlist_id = $1), 0)
       ON CONFLICT (watchlist_id, symbol_id) DO NOTHING`,
      [req.params.id, ids[0]],
    );

    const [updated] = await selectWatchlists(req.user.id, req.params.id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /watchlists/:id/symbols — replace the display order. The client sends the
// full array it already holds after a drag, so there's no from/to to reconcile.
router.put('/:id/symbols', requireAuth, async (req, res) => {
  const { symbols } = req.body;
  if (!Array.isArray(symbols)) {
    return res.status(400).json({ error: 'symbols must be an array' });
  }

  const tickers = symbols
    .map((s) => String(s || '').toUpperCase().trim())
    .filter(Boolean);

  if (new Set(tickers).size !== tickers.length) {
    return res.status(400).json({ error: 'symbols must not contain duplicates' });
  }

  try {
    const watchlist = await findOwned(req.user.id, req.params.id);
    if (!watchlist) return res.status(404).json({ error: 'Watchlist not found' });

    if (tickers.length > 0) {
      const ids = await resolveSymbolIds(tickers);
      if (!ids) return res.status(400).json({ error: 'Unknown symbol' });

      // Rows whose ticker isn't in the body keep their current position; ids
      // that aren't on this list match nothing and are no-ops.
      await pool.query(
        `UPDATE watchlist_symbols ws
         SET position = t.pos - 1
         FROM unnest($2::varchar[]) WITH ORDINALITY AS t(symbol_id, pos)
         WHERE ws.watchlist_id = $1 AND ws.symbol_id = t.symbol_id`,
        [req.params.id, ids],
      );
    }

    const [updated] = await selectWatchlists(req.user.id, req.params.id);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /watchlists/:id/symbols/:symbol — ownership enforced through the join
router.delete('/:id/symbols/:symbol', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(404).json({ error: 'Watchlist not found' });
  }
  const symbol = req.params.symbol.toUpperCase().trim();

  try {
    const { rowCount } = await pool.query(
      `DELETE FROM watchlist_symbols ws
       USING watchlists w, symbols s
       WHERE ws.watchlist_id = w.id AND ws.symbol_id = s.id
         AND w.id = $1 AND w.user_id = $2 AND s.symbol = $3`,
      [req.params.id, req.user.id, symbol],
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Symbol not on this watchlist' });
    }
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
