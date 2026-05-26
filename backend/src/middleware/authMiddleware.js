const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');

function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Missing token' });

    const payload = jwt.verify(token, JWT_SECRET);

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      companyId: payload.companyId,
    };

    next();
  } catch (e) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    next();
  };
}

module.exports = { requireAuth, requireRole };

