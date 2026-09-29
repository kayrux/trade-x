const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { UUID_RE } = require('../lib/symbols');
const { findOwnedAccount } = require('../lib/accounts');

const router = express.Router();

// Postgres unique_violation — see idx_accounts_user_name_lower in 008_accounts.sql.
const UNIQUE_VIOLATION = '23505';

const MAX_NAME_LENGTH = 60;
const MAX_TYPE_LENGTH = 40;

function cleanType(raw) {
  if (raw === undefined || raw === null) return null;
  const type = String(raw).trim();
  if (!type) return null;
  if (type.length > MAX_TYPE_LENGTH) return { error: `type must be ${MAX_TYPE_LENGTH} characters or fewer` };
  return { value: type };
}

// GET /accounts — every account owned by the caller, oldest first
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, type, created_at FROM accounts
       WHERE user_id = $1 ORDER BY created_at`,
      [req.user.id],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /accounts — { name, type? }
router.post('/', requireAuth, async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (name.length > MAX_NAME_LENGTH) {
    return res.status(400).json({ error: `name must be ${MAX_NAME_LENGTH} characters or fewer` });
  }
  const type = cleanType(req.body.type);
  if (type && type.error) return res.status(400).json({ error: type.error });

  try {
    const { rows } = await pool.query(
      `INSERT INTO accounts (user_id, name, type) VALUES ($1, $2, $3)
       RETURNING id, name, type, created_at`,
      [req.user.id, name, type ? type.value : null],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      return res.status(400).json({ error: 'You already have an account with that name' });
    }
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH /accounts/:id — rename and/or retype
router.patch('/:id', requireAuth, async (req, res) => {
  const sets = [];
  const params = [];

  if (req.body.name !== undefined) {
    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name cannot be blank' });
    if (name.length > MAX_NAME_LENGTH) {
      return res.status(400).json({ error: `name must be ${MAX_NAME_LENGTH} characters or fewer` });
    }
    params.push(name);
    sets.push(`name = $${params.length}`);
  }

  if (req.body.type !== undefined) {
    const type = cleanType(req.body.type);
    if (type && type.error) return res.status(400).json({ error: type.error });
    params.push(type ? type.value : null);
    sets.push(`type = $${params.length}`);
  }

  if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

  try {
    if (!(await findOwnedAccount(req.user.id, req.params.id))) {
      return res.status(404).json({ error: 'Account not found' });
    }
    params.push(req.params.id, req.user.id);
    const { rows } = await pool.query(
      `UPDATE accounts SET ${sets.join(', ')}
       WHERE id = $${params.length - 1} AND user_id = $${params.length}
       RETURNING id, name, type, created_at`,
      params,
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      return res.status(400).json({ error: 'You already have an account with that name' });
    }
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /accounts/:id — trades + holdings cascade away with it
router.delete('/:id', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) {
    return res.status(404).json({ error: 'Account not found' });
  }
  try {
    const { rowCount } = await pool.query(
      `DELETE FROM accounts WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id],
    );
    if (rowCount === 0) return res.status(404).json({ error: 'Account not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
