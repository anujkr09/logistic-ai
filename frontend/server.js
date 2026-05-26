const express = require('express');
const path = require('path');
const app = express();

const PORT = process.env.PORT || process.env.FRONTEND_PORT || 3000;
const dynamicApp = path.join(__dirname, 'app.html');
const fallbackFile = require('fs').existsSync(dynamicApp) ? dynamicApp : path.join(__dirname, 'index.html');

app.set('trust proxy', true);

app.get('/download-app', (req, res) => {
  const appUrl = `${req.protocol}://${req.get('host')}/index.html`;
  const launcher = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=${appUrl}">
  <title>Open shipX AI Logistics</title>
</head>
<body>
  <p>Opening shipX AI Logistics...</p>
  <p><a href="${appUrl}">Open app</a></p>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Content-Disposition', 'attachment; filename="shipX AI Logistics.html"');
  res.send(launcher);
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/assets/')) return next();
  if (req.path === '/manifest.webmanifest' || req.path === '/service-worker.js') return next();

  const ext = path.extname(req.path);
  if (!ext || ext === '.html') {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    return res.sendFile(fallbackFile);
  }

  return next();
});

// Serve static files from the current directory
app.use(express.static(path.join(__dirname), {
  setHeaders(res, filePath) {
    const name = path.basename(filePath);
    const ext = path.extname(filePath);
    if (name === 'service-worker.js' || ext === '.html' || ext === '.webmanifest' || ext === '.js') {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
  }
}));

// Handle SPA routing - serve the dynamic app shell for all routes
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.sendFile(fallbackFile);
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
