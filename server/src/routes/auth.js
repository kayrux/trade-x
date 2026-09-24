const express = require('express');
const pool = require('../db');
const {
  hashPassword,
  verifyPassword,
  signToken,
  publicUser,
} = require('../lib/auth');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;
const MIN_PASSWORD_LENGTH = 8;

// Postgres unique_violation — see the unique indexes in 004_accounts.sql.
const UNIQUE_VIOLATION = '23505';

function validateRegistration({ email, username, password }) {
  if (!email || !username || !password) {
    return 'email, username, and password are required';
  }
  if (!EMAIL_RE.test(email)) {
    return 'Enter a valid email address';
  }
  if (!USERNAME_RE.test(username)) {
    return 'Username must be 3-30 characters, letters, numbers, and underscores only';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return null;
}

// POST /auth/register — always creates a non-admin user.
router.post('/register', async (req, res) => {
  const email = (req.body.email || '').trim();
  const username = (req.body.username || '').trim();
  const { password } = req.body;

  const invalid = validateRegistration({ email, username, password });
  if (invalid) return res.status(400).json({ error: invalid });

  let passwordHash;
  try {
    passwordHash = await hashPassword(password);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Could not create account' });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, username, password_hash, display_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [email, username, passwordHash, username],
    );
    const user = publicUser(rows[0]);
    res.status(201).json({ token: signToken(rows[0]), user });
  } catch (err) {
    // Let the unique indexes arbitrate rather than checking first, which would
    // race between the SELECT and the INSERT.
    if (err.code === UNIQUE_VIOLATION) {
      const takenField = /username/i.test(err.constraint || '') ? 'Username' : 'Email';
      return res.status(400).json({ error: `${takenField} is already taken` });
    }
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim();
  const { password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM users WHERE LOWER(email) = LOWER($1)`,
      [email],
    );

    // Deliberately identical response for "no such user" and "wrong password"
    // so the endpoint can't be used to enumerate registered emails.
    const user = rows[0];
    const ok = user && (await verifyPassword(password, user.password_hash));
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /auth/me — re-reads from the DB so a stale token payload (e.g. is_admin
// granted or revoked since signing) never masks the current row.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM users WHERE id = $1`, [
      req.user.id,
    ]);
    if (rows.length === 0) {
      // Token is valid but the account is gone — treat as logged out.
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
