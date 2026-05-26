const jwt = require('jsonwebtoken');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');

function signAccessToken({ user }) {
  return jwt.sign(
    {
      email: user.email,
      role: user.role,
      companyId: String(user.companyId),
    },
    JWT_SECRET,
    {
      subject: String(user._id),
      expiresIn: JWT_EXPIRES_IN,
    }
  );
}

module.exports = { signAccessToken };

