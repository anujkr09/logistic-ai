const express = require('express');
require('express-async-errors');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const { notFound, errorHandler } = require('./middleware/errorMiddleware');

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
const { CORS_ORIGIN } = require('./config/env');

const app = express();


app.use(helmet());
app.use(cors({
  origin: CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  credentials: CORS_ORIGIN !== '*',
}));
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

app.get('/health', (req, res) => res.json({ ok: true }));

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

const frontendDir = path.resolve(__dirname, '../../frontend');
const dynamicApp = path.join(frontendDir, 'app.html');
const frontendIndex = fs.existsSync(dynamicApp) ? dynamicApp : path.join(frontendDir, 'index.html');

if (fs.existsSync(frontendIndex)) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    if (req.path.startsWith('/assets/') || req.path.startsWith('/socket.io/')) return next();
    if (req.path === '/manifest.webmanifest' || req.path === '/service-worker.js') return next();

    const ext = path.extname(req.path);
    const wantsHtml = req.accepts('html');
    if (!ext || ext === '.html') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return res.sendFile(frontendIndex);
    }

    return next();
  });

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
    return res.sendFile(frontendIndex);
  });
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;


