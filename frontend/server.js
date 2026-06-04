const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || process.env.FRONTEND_PORT || 3000;
const fallbackFile = path.join(__dirname, 'app.html');
const apiBaseUrl = (process.env.API_BASE_URL || '').replace(/\/$/, '');
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.PUBLIC_GOOGLE_MAPS_API_KEY || '';
const legacyHostRedirects = {
  'shipx-ai-logistics.onrender.com': 'zyraviq-ai-logistics.onrender.com',
  'shipx-ai-frontend.onrender.com': 'zyraviq-ai.onrender.com',
  'zyraviq-ai-frontend.onrender.com': 'zyraviq-ai.onrender.com',
};

app.set('trust proxy', true);

app.use((req, res, next) => {
  const host = String(req.get('host') || '').toLowerCase().split(':')[0];
  const targetHost = legacyHostRedirects[host];
  if (!targetHost) return next();

  const protocol = req.protocol || 'https';
  return res.redirect(308, `${protocol}://${targetHost}${req.originalUrl || req.url || '/'}`);
});

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(self)');
  next();
});

app.get('/health', (req, res) => {
  res.json({ ok: true, app: 'ZYRAVIQ AI Logistics frontend' });
});

app.get('/robots.txt', (req, res, next) => {
  res.type('text/plain');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(__dirname, 'robots.txt'), (err) => {
    if (err) next(err);
  });
});

app.get('/sitemap.xml', (req, res, next) => {
  res.type('application/xml');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(path.join(__dirname, 'sitemap.xml'), (err) => {
    if (err) next(err);
  });
});

app.get('/runtime-config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.send([
    `window.API_BASE_URL=${JSON.stringify(apiBaseUrl)};`,
    `window.GOOGLE_MAPS_API_KEY=${JSON.stringify(googleMapsApiKey)};`,
  ].join('\n'));
});

app.get('/download-app', (req, res) => {
  const appUrl = `${req.protocol}://${req.get('host')}/app.html`;
  const launcher = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=${appUrl}">
  <title>Open ZYRAVIQ AI Logistics</title>
</head>
<body>
  <p>Opening ZYRAVIQ AI Logistics...</p>
  <p><a href="${appUrl}">Open app</a></p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Content-Disposition', 'attachment; filename="ZYRAVIQ AI Logistics.html"');
  res.send(launcher);
});

function sendHtmlWithRuntimeConfig(filePath, res, next) {
  fs.readFile(filePath, 'utf8', (err, html) => {
    if (err) {
      if (next) return next(err);
      res.status(500).send('Unable to load page');
      return;
    }

    const configScript = '<script src="/runtime-config.js"></script>';
    const body = html.includes(configScript)
      ? html
      : html.replace('</head>', `  ${configScript}\n</head>`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.send(body);
  });
}

app.get(['/', '/index.html', '/app.html', '/pages/*.html'], (req, res, next) => {
  const requested = req.path === '/' ? '/index.html' : req.path;
  const filePath = path.join(__dirname, requested);
  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath)) return next();
  sendHtmlWithRuntimeConfig(filePath, res, next);
});

app.get(['/tracking', '/tracking/'], (req, res, next) => {
  sendHtmlWithRuntimeConfig(path.join(__dirname, 'pages', 'tracking.html'), res, next);
});

// Serve static files from the current directory
app.use(express.static(path.join(__dirname), {
  setHeaders(res, filePath) {
    const name = path.basename(filePath);
    const ext = path.extname(filePath);
    if (name === 'service-worker.js' || ext === '.html' || ext === '.webmanifest' || ext === '.js' || ext === '.css') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    } else if (['.png', '.jpg', '.jpeg', '.webp', '.svg', '.ico', '.woff2'].includes(ext)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Handle SPA routing - serve the dynamic app shell for all routes
app.get('*', (req, res) => {
  sendHtmlWithRuntimeConfig(fallbackFile, res);
});

const server = app.listen(PORT, () => {
  console.log(`Frontend server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the existing process or set FRONTEND_PORT/PORT to a free port.`);
    process.exit(1);
  }
  throw err;
});
