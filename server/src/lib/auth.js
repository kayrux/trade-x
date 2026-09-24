const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const BCRYPT_ROUNDS = 12;
const TOKEN_TTL = '7d';

// Fail loudly at require-time rather than signing tokens with `undefined`,
// which jsonwebtoken would happily accept as a secret.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is required — add it to server/.env');
}

function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, is_admin: user.is_admin },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL },
  );
}

// Throws on an expired, tampered, or malformed token — callers decide whether
// that means "anonymous" (attachUser) or 401 (requireAuth).
function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

// Every route that returns a user goes through this, so password_hash can
// never reach a response body.
function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    display_name: row.display_name,
    is_admin: row.is_admin,
    created_at: row.created_at,
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  verifyToken,
  publicUser,
};
