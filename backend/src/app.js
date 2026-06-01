const express = require('express');
require('express-async-errors');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { rateLimit } = require('./middleware/rateLimitMiddleware');

const authRoutes = require('./routes/authRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const warehouseRoutes = require('./routes/warehouseRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const fraudRoutes = require('./routes/fraudRoutes');
const aiRoutes = require('./routes/aiRoutes');
const publicAiRoutes = require('./routes/publicAiRoutes');
const uiRoutes = require('./routes/uiRoutes');
const workspaceRoutes = require('./routes/workspaceRoutes');
const { CORS_ORIGIN } = require('./config/env');

const app = express();
const legacyHostRedirects = {
  'shipx-ai-logistics.onrender.com': 'zyraviq-ai-logistics.onrender.com',
};

const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.RATE_LIMIT_MAX || 180),
});
const authLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 30),
});

app.set('trust proxy', true);

app.use((req, res, next) => {
  const host = String(req.get('host') || '').toLowerCase().split(':')[0];
  const targetHost = legacyHostRedirects[host];
  if (!targetHost) return next();

  const protocol = req.protocol || 'https';
  return res.redirect(308, `${protocol}://${targetHost}${req.originalUrl || req.url || '/'}`);
});

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      'script-src': ["'self'", 'https://cdn.socket.io'],
      'img-src': ["'self'", 'data:', 'https:'],
      'connect-src': ["'self'", 'https:', 'wss:'],
      'frame-src': ["'self'", 'https://www.openstreetmap.org'],
    },
  },
}));
app.use(cors({
  origin: CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  credentials: CORS_ORIGIN !== '*',
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ ok: true, app: 'ZYRAVIQ AI Logistics backend', brand: 'ZYRAVIQ' }));

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatbotRoutes);
app.use('/api/fraud', fraudRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/ai/public', publicAiRoutes);
app.use('/api/ui', uiRoutes);
app.use('/api/workspace', workspaceRoutes);

const frontendDir = path.resolve(__dirname, '../../frontend');
const frontendIndex = path.join(frontendDir, 'index.html');
const frontendApp = path.join(frontendDir, 'app.html');

if (fs.existsSync(frontendIndex)) {
  app.use(express.static(frontendDir, {
    setHeaders(res, filePath) {
      const name = path.basename(filePath);
      const ext = path.extname(filePath);
      if (name === 'service-worker.js' || ext === '.html' || ext === '.webmanifest' || ext === '.js') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      }
    },
  }));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    if (!req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.sendFile(fs.existsSync(frontendApp) ? frontendApp : frontendIndex);
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;


