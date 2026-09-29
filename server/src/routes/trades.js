const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { UUID_RE, resolveSymbolIds } = require('../lib/symbols');
const { recomputeHolding } = require('../lib/holdings');

const router = express.Router();

// A sell that exceeds the shares held rolls the write back and answers 400 with
// the recompute's explanation, rather than the generic 500.
function handleMutationError(err, res) {
  if (err.code === 'OVERSELL') {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: 'Database error' });
}

const SIDES = new Set(['buy', 'sell']);
const MAX_NOTE_LENGTH = 280;

// Every handler returns a trade in this shape: the ticker is joined in (the row
// stores a FIGI symbol_id), so the client never sees the internal id.
async function selectTrades(userId, { symbol = null, tradeId = null } = {}) {
  const { rows } = await pool.query(
    `SELECT t.id, s.symbol, t.side, t.quantity, t.price,
            t.traded_at, t.note, t.updated_at
     FROM trades t
     JOIN symbols s ON s.id = t.symbol_id
     WHERE t.user_id = $1
       AND ($2::text IS NULL OR s.symbol = $2)
       AND ($3::uuid IS NULL OR t.id = $3::uuid)
     ORDER BY t.traded_at, t.created_at`,
    [userId, symbol, tradeId],
  );
  return rows;
}

// Ownership gate for the :id routes. Returns { id, symbol_id } or null — a
// missing row and someone else's row are indistinguishable on purpose.
async function findOwnedTrade(userId, tradeId) {
  if (!UUID_RE.test(tradeId)) return null;
  const { rows } = await pool.query(
    `SELECT id, symbol_id FROM trades WHERE id = $1 AND user_id = $2`,
    [tradeId, userId],
  );
  return rows[0] || null;
}

// Validates the mutable fields. `partial` allows a PATCH to omit fields; a POST
// requires side, quantity, price, and traded_at. Returns { error } or { values }
// where values holds only the provided, cleaned fields.
function validateTrade(body, { partial } = {}) {
  const values = {};

  if (body.side !== undefined || !partial) {
    const side = String(body.side || '').toLowerCase();
    if (!SIDES.has(side)) return { error: "side must be 'buy' or 'sell'" };
    values.side = side;
  }

  if (body.quantity !== undefined || !partial) {
    const quantity = Number(body.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: 'quantity must be a positive number' };
    }
    values.quantity = quantity;
  }

  if (body.price !== undefined || !partial) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return { error: 'price must be a non-negative number' };
    }
    values.price = price;
  }

  if (body.traded_at !== undefined || !partial) {
    const ts = new Date(body.traded_at);
    if (Number.isNaN(ts.getTime())) return { error: 'traded_at must be a valid date' };
    values.traded_at = ts.toISOString();
  }

  if (body.note !== undefined) {
    const note = body.note === null ? null : String(body.note).trim();
    if (note && note.length > MAX_NOTE_LENGTH) {
      return { error: `note must be ${MAX_NOTE_LENGTH} characters or fewer` };
    }
    values.note = note || null;
  }

  return { values };
}

// GET /trades?symbol=AAPL — the caller's trades, oldest first
router.get('/', requireAuth, async (req, res) => {
  const symbol = req.query.symbol
    ? String(req.query.symbol).toUpperCase().trim()
    : null;
  try {
    res.json(await selectTrades(req.user.id, { symbol }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /trades — record a trade, then recompute the holding in the same tx
router.post('/', requireAuth, async (req, res) => {
  const symbol = String(req.body.symbol || '').toUpperCase().trim();
  if (!symbol) return res.status(400).json({ error: 'symbol is required' });

  const { error, values } = validateTrade(req.body, { partial: false });
  if (error) return res.status(400).json({ error });

  const client = await pool.connect();
  try {
    const ids = await resolveSymbolIds([symbol]);
    if (!ids) return res.status(400).json({ error: 'Unknown symbol' });
    const symbolId = ids[0];

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO trades (user_id, symbol_id, side, quantity, price, traded_at, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [req.user.id, symbolId, values.side, values.quantity, values.price,
       values.traded_at, values.note ?? null],
    );
    await recomputeHolding(client, req.user.id, symbolId);
    await client.query('COMMIT');

    const [trade] = await selectTrades(req.user.id, { tradeId: rows[0].id });
    res.status(201).json(trade);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    handleMutationError(err, res);
  } finally {
    client.release();
  }
});

// PATCH /trades/:id — edit an owned trade, then recompute its holding
router.patch('/:id', requireAuth, async (req, res) => {
  const { error, values } = validateTrade(req.body, { partial: true });
  if (error) return res.status(400).json({ error });
  if (Object.keys(values).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const client = await pool.connect();
  try {
    const owned = await findOwnedTrade(req.user.id, req.params.id);
    if (!owned) return res.status(404).json({ error: 'Trade not found' });

    // Build the SET list from only the provided fields; updated_at always bumps.
    const cols = Object.keys(values);
    const assignments = cols.map((c, i) => `${c} = $${i + 1}`);
    const params = cols.map((c) => values[c]);
    params.push(req.params.id, req.user.id);

    await client.query('BEGIN');
    await client.query(
      `UPDATE trades SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${cols.length + 1} AND user_id = $${cols.length + 2}`,
      params,
    );
    await recomputeHolding(client, req.user.id, owned.symbol_id);
    await client.query('COMMIT');

    const [trade] = await selectTrades(req.user.id, { tradeId: req.params.id });
    res.json(trade);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    handleMutationError(err, res);
  } finally {
    client.release();
  }
});

// DELETE /trades/:id — remove an owned trade, then recompute its holding
router.delete('/:id', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const owned = await findOwnedTrade(req.user.id, req.params.id);
    if (!owned) return res.status(404).json({ error: 'Trade not found' });

    await client.query('BEGIN');
    await client.query(`DELETE FROM trades WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.user.id,
    ]);
    await recomputeHolding(client, req.user.id, owned.symbol_id);
    await client.query('COMMIT');

    res.status(204).end();
  } catch (err) {
    // Deleting a buy can leave a later sell oversold; that rolls back with a 400
    // explaining which sell now lacks the shares, rather than silently corrupting
    // the position.
    await client.query('ROLLBACK').catch(() => {});
    handleMutationError(err, res);
  } finally {
    client.release();
  }
});

module.exports = router;
