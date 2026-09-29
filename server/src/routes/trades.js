const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { UUID_RE, resolveSymbolIds } = require('../lib/symbols');
const { findOwnedAccount } = require('../lib/accounts');
const { recomputeHolding } = require('../lib/holdings');
const { invalidateAccountValueCache } = require('../lib/portfolioValue');

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
const CURRENCY_RE = /^[A-Z]{3}$/;

// Trades are scoped to an account; the ticker is joined in (the row stores a
// FIGI symbol_id), so the client never sees the internal id.
async function selectTrades(accountId, { symbol = null, tradeId = null } = {}) {
  const { rows } = await pool.query(
    `SELECT t.id, t.account_id, s.symbol, t.side, t.quantity, t.price,
            t.currency, t.traded_at, t.note, t.updated_at
     FROM trades t
     JOIN symbols s ON s.id = t.symbol_id
     WHERE t.account_id = $1
       AND ($2::text IS NULL OR s.symbol = $2)
       AND ($3::uuid IS NULL OR t.id = $3::uuid)
     ORDER BY t.traded_at, t.created_at`,
    [accountId, symbol, tradeId],
  );
  return rows;
}

// Ownership gate for the :id routes — enforced through the trade's account. A
// missing trade and someone else's are indistinguishable on purpose. Returns
// { id, symbol_id, account_id } or null.
async function findOwnedTrade(userId, tradeId) {
  if (!UUID_RE.test(tradeId)) return null;
  const { rows } = await pool.query(
    `SELECT t.id, t.symbol_id, t.account_id
     FROM trades t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.id = $1 AND a.user_id = $2`,
    [tradeId, userId],
  );
  return rows[0] || null;
}

// Validates the mutable fields. `partial` allows a PATCH to omit fields; a POST
// requires side, quantity, price, currency, and traded_at. Returns { error } or
// { values } where values holds only the provided, cleaned fields.
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

  if (body.currency !== undefined || !partial) {
    const currency = String(body.currency || '').toUpperCase().trim();
    if (!CURRENCY_RE.test(currency)) {
      return { error: 'currency must be a 3-letter code (e.g. USD, CAD)' };
    }
    values.currency = currency;
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

// GET /trades?account_id=…&symbol=AAPL — an account's trades, oldest first
router.get('/', requireAuth, async (req, res) => {
  const accountId = req.query.account_id;
  if (!accountId) return res.status(400).json({ error: 'account_id is required' });

  const symbol = req.query.symbol
    ? String(req.query.symbol).toUpperCase().trim()
    : null;
  try {
    if (!(await findOwnedAccount(req.user.id, accountId))) {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.json(await selectTrades(accountId, { symbol }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /trades — record a trade in an account, then recompute the holding
router.post('/', requireAuth, async (req, res) => {
  const accountId = req.body.account_id;
  if (!accountId) return res.status(400).json({ error: 'account_id is required' });

  const symbol = String(req.body.symbol || '').toUpperCase().trim();
  if (!symbol) return res.status(400).json({ error: 'symbol is required' });

  const { error, values } = validateTrade(req.body, { partial: false });
  if (error) return res.status(400).json({ error });

  const client = await pool.connect();
  try {
    if (!(await findOwnedAccount(req.user.id, accountId))) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const ids = await resolveSymbolIds([symbol]);
    if (!ids) return res.status(400).json({ error: 'Unknown symbol' });
    const symbolId = ids[0];

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO trades (account_id, symbol_id, side, quantity, price, currency, traded_at, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [accountId, symbolId, values.side, values.quantity, values.price,
       values.currency, values.traded_at, values.note ?? null],
    );
    await recomputeHolding(client, accountId, symbolId);
    await invalidateAccountValueCache(client, accountId);
    await client.query('COMMIT');

    const [trade] = await selectTrades(accountId, { tradeId: rows[0].id });
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
    params.push(req.params.id);

    await client.query('BEGIN');
    await client.query(
      `UPDATE trades SET ${assignments.join(', ')}, updated_at = NOW()
       WHERE id = $${cols.length + 1}`,
      params,
    );
    await recomputeHolding(client, owned.account_id, owned.symbol_id);
    await invalidateAccountValueCache(client, owned.account_id);
    await client.query('COMMIT');

    const [trade] = await selectTrades(owned.account_id, { tradeId: req.params.id });
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
    await client.query(`DELETE FROM trades WHERE id = $1`, [req.params.id]);
    await recomputeHolding(client, owned.account_id, owned.symbol_id);
    await invalidateAccountValueCache(client, owned.account_id);
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
