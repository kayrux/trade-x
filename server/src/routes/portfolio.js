const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { findOwnedAccount } = require('../lib/accounts');
const {
  pricedHoldings,
  summarize,
  accountSeries,
  combinedSeries,
} = require('../lib/portfolioValue');

const router = express.Router();

// Every /portfolio route requires auth and is scoped to the caller: holdings and
// trades reach their owner through accounts.user_id, and an account that isn't
// the caller's answers 404 (indistinguishable from missing), like /watchlists.

// GET /portfolio/summary — total value across all the user's accounts, plus a
// per-account breakdown for the "Investing" list on the Portfolio page.
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const { rows: accounts } = await pool.query(
      `SELECT id, name, type, created_at FROM accounts
        WHERE user_id = $1 ORDER BY created_at`,
      [req.user.id],
    );

    const perAccount = await Promise.all(
      accounts.map(async (a) => {
        const holdings = await pricedHoldings(a.id);
        return { account: a, summary: summarize(holdings) };
      }),
    );

    const total = perAccount.reduce(
      (acc, { summary }) => {
        acc.value += summary.value;
        acc.cost_basis += summary.cost_basis;
        return acc;
      },
      { value: 0, cost_basis: 0 },
    );
    const returnAbs = total.value - total.cost_basis;
    const returnPct = total.cost_basis ? (returnAbs / total.cost_basis) * 100 : null;

    res.json({
      total_value: total.value,
      cost_basis: total.cost_basis,
      return_abs: returnAbs,
      return_pct: returnPct,
      accounts: perAccount.map(({ account, summary }) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        value: summary.value,
        cost_basis: summary.cost_basis,
        return_abs: summary.return_abs,
        return_pct: summary.return_pct,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /portfolio/history?range=ytd — combined value-over-time across all the
// user's accounts.
router.get('/history', requireAuth, async (req, res) => {
  try {
    const { rows: accounts } = await pool.query(
      `SELECT id FROM accounts WHERE user_id = $1`,
      [req.user.id],
    );
    const series = await combinedSeries(accounts.map((a) => a.id), req.query.range);
    res.json({ range: req.query.range || '1y', series });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /portfolio/accounts/:id — one account's summary + priced holdings, for the
// Account Details page.
router.get('/accounts/:id', requireAuth, async (req, res) => {
  try {
    const account = await findOwnedAccount(req.user.id, req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const holdings = await pricedHoldings(account.id);
    res.json({ account, summary: summarize(holdings), holdings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /portfolio/accounts/:id/history?range=ytd — one account's value-over-time.
router.get('/accounts/:id/history', requireAuth, async (req, res) => {
  try {
    const account = await findOwnedAccount(req.user.id, req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const series = await accountSeries(account.id, req.query.range);
    res.json({ range: req.query.range || '1y', series });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
