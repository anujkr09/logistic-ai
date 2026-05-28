const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const requiredFiles = [
  'index.html',
  'app.html',
  'manifest.webmanifest',
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

const serviceWorker = fs.readFileSync(path.join(root, 'service-worker.js'), 'utf8');
if (!serviceWorker.includes('./app.html') || !serviceWorker.includes('dynamicApp.js')) {
  fail('Service worker must cache the dynamic app shell.');
}

if (!process.exitCode) {
  console.log('Static frontend build check passed.');
}
