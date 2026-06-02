const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const requiredFiles = [
  'index.html',
  'app.html',
  'manifest.webmanifest',
  'robots.txt',
  'sitemap.xml',
  'service-worker.js',
  'server.js',
  'assets/css/style.css',
  'assets/css/dynamic-app.css',
  'assets/css/responsive.css',
  'assets/js/app.js',
  'assets/js/dynamicApp.js',
  'assets/js/auth.js',
  'assets/js/dashboard.js',
  'assets/js/tracking.js',
  'pages/login.html',
  'pages/register.html',
  'pages/profile.html',
  'pages/tracking.html',
];

const jsFiles = [
  'server.js',
  'assets/js/app.js',
  'assets/js/auth.js',
  'assets/js/dashboard.js',
  'assets/js/dynamicApp.js',
  'assets/js/dynamicRenderer.js',
  'assets/js/dynamicServicePages.js',
  'assets/js/maps.js',
  'assets/js/notifications.js',
  'assets/js/profile.js',
  'assets/js/socket.js',
  'assets/js/tracking.js',
  'assets/js/universalChatbot.js',
  'assets/js/warehouse.js',
  'service-worker.js',
];

const sourceFiles = [
  ...requiredFiles,
  'assets/js/maps.js',
  'assets/js/profile.js',
  'assets/css/auth.css',
  'assets/css/tracking.css',
].filter((file, index, list) => list.indexOf(file) === index);

const mojibakePattern = /[ÃÂ�]|â[^\s]/;

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) fail(`Missing required file: ${file}`);
}

for (const file of jsFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    fail(`Missing JavaScript file: ${file}`);
    continue;
  }

  const result = spawnSync(process.execPath, ['--check', fullPath], {
    cwd: root,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    fail(`Syntax check failed: ${file}\n${result.stderr || result.stdout}`);
  }
}

for (const file of sourceFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) continue;
  const content = fs.readFileSync(fullPath, 'utf8');
  if (mojibakePattern.test(content)) {
    fail(`Possible encoding issue found in: ${file}`);
  }
}

const appHtml = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
if (!appHtml.includes('app-splash') || !appHtml.includes('dynamic-app.css')) {
  fail('Dynamic app shell must include the branded startup splash and dynamic CSS.');
}
if (!appHtml.includes('meta name="description"') || !appHtml.includes('rel="canonical"')) {
  fail('Dynamic app shell must include SEO description and canonical metadata.');
}

const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
if (!indexHtml.includes('meta name="description"') || !indexHtml.includes('rel="canonical"')) {
  fail('Home page must include SEO description and canonical metadata.');
}

const robotsTxt = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
const sitemapXml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
if (!robotsTxt.includes('Sitemap: https://zyraviq-ai-frontend.onrender.com/sitemap.xml') || !sitemapXml.includes('https://zyraviq-ai-frontend.onrender.com/')) {
  fail('SEO discovery files must point to the production frontend URL.');
}

const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
if (!serviceWorker.includes('./app.html') || !serviceWorker.includes('dynamicApp.js')) {
  fail('Service worker must cache the dynamic app shell.');
}

const trackingHtml = fs.readFileSync(path.join(root, 'pages/tracking.html'), 'utf8');
if (!trackingHtml.includes('/runtime-config.js') || !trackingHtml.includes('assets/js/maps.js')) {
  fail('Tracking page must load runtime config before the map script.');
}

const frontendServer = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
if (!frontendServer.includes('GOOGLE_MAPS_API_KEY') || !frontendServer.includes('window.GOOGLE_MAPS_API_KEY')) {
  fail('Frontend runtime config must expose the public Google Maps key.');
}
if (!frontendServer.includes("app.get('/robots.txt'") || !frontendServer.includes("app.get('/sitemap.xml'")) {
  fail('Frontend server must serve robots.txt and sitemap.xml before SPA fallback.');
}

if (!process.exitCode) {
  console.log('Static frontend build check passed.');
}
