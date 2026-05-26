const crypto = require('crypto');

// Simple PBKDF2-based hash. Replace with bcrypt in production.
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split('$');
  if (!salt || !hash) return false;
  const check = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return check === hash;
}

module.exports = { hashPassword, verifyPassword };

