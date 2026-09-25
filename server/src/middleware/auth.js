const { verifyToken } = require('../lib/auth');

// Reads the Bearer token if one is present and sets req.user. Never rejects —
// mounted globally so public routes can still tell who (if anyone) is calling.
// An invalid or expired token is simply treated as anonymous; requireAuth is
// what turns that into a 401.
function attachUser(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const payload = verifyToken(token);
      req.user = {
        id: payload.sub,
        username: payload.username,
        is_admin: payload.is_admin === true,
      };
    } catch {
      // Expired/tampered token — fall through as anonymous.
    }
  }

  next();
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!req.user.is_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

module.exports = { attachUser, requireAuth, requireAdmin };
