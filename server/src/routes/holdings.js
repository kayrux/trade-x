const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { findOwnedAccount } = require('../lib/accounts');

const router = express.Router();

// GET /holdings?account_id=… — the account's positions. Rows are maintained by
// the /trades routes (see server/src/lib/holdings.js), so this is a plain read.
// Flat, fully-closed positions (quantity 0) are hidden by default; pass ?all=1
// to include them, e.g. to show lifetime realized P&L on names no longer held.
router.get('/', requireAuth, async (req, res) => {
  const accountId = req.query.account_id;
  if (!accountId) return res.status(400).json({ error: 'account_id is required' });

  const includeFlat = req.query.all === '1' || req.query.all === 'true';
  try {
    if (!(await findOwnedAccount(req.user.id, accountId))) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const { rows } = await pool.query(
      `SELECT s.symbol, h.quantity, h.avg_cost, h.realized_pnl, h.currency, h.updated_at
       FROM portfolio_holdings h
       JOIN symbols s ON s.id = h.symbol_id
       WHERE h.account_id = $1
         AND ($2 OR h.quantity <> 0)
       ORDER BY s.symbol`,
      [accountId, includeFlat],
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
