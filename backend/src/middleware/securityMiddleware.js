const crypto = require('crypto');
const { AuditLog } = require('../services/models');

const CSRF_COOKIE = 'zyraviq_csrf';
const CSRF_HEADER = 'x-csrf-token';

function parseCookies(header = '') {
  return String(header || '').split(';').reduce((cookies, pair) => {
    const index = pair.indexOf('=');
    if (index === -1) return cookies;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function csrfToken() {
  return crypto.randomBytes(24).toString('hex');
}

function setCsrfCookie(res, token) {
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function csrfProtection(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const path = req.originalUrl?.split('?')[0] || req.path || '';
  const publicAuthWrites = new Set([
    '/api/auth/login',
    '/api/auth/login/request-otp',
    '/api/auth/login/verify-otp',
    '/api/auth/register',
  ]);
  if (publicAuthWrites.has(path) || publicAuthWrites.has(req.path)) return next();

  const cookies = parseCookies(req.headers.cookie);
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ message: 'CSRF validation failed. Refresh the page and try again.' });
  }

  return next();
}

function auditAction(action, resourceType = '') {
  return async (req, res, next) => {
    const startedAt = Date.now();
    res.on('finish', async () => {
      try {
        await AuditLog.create({
          companyId: req.user?.companyId || null,
          userId: req.user?.id || null,
          action,
          resourceType,
          resourceId: req.params?.trackingNumber || req.params?.id || req.body?.trackingNumber || '',
          ip: req.ip || req.socket?.remoteAddress || '',
          userAgent: req.get('user-agent') || '',
          success: res.statusCode < 400,
          meta: {
            method: req.method,
            path: req.originalUrl || req.url,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
          },
        });
      } catch (e) {
        // Audit logging should never block the user workflow.
      }
    });
    next();
  };
}

module.exports = { csrfToken, setCsrfCookie, csrfProtection, auditAction, CSRF_HEADER };
