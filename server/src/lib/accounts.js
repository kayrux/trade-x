const pool = require('../db');
const { UUID_RE } = require('./symbols');

// Ownership gate for account-scoped routes. Returns the account row or null — a
// missing account and someone else's are indistinguishable on purpose, so a 404
// can't be used to probe which account ids exist. A non-uuid id is screened out
// here so it never reaches Postgres as a failed uuid cast (22P02 → 500).
async function findOwnedAccount(userId, accountId) {
  if (!accountId || !UUID_RE.test(accountId)) return null;
  const { rows } = await pool.query(
    `SELECT id, name, type, created_at FROM accounts WHERE id = $1 AND user_id = $2`,
    [accountId, userId],
  );
  return rows[0] || null;
}

module.exports = { findOwnedAccount };
