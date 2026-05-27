const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

const requiredFiles = [
  'index.html',
  'app.html',
  'server.js',
  'assets/css/style.css',
  'assets/css/dynamic-app.css',
  'assets/js/app.js',
  'assets/js/dynamicApp.js',
  'assets/js/auth.js',
  'assets/js/dashboard.js',
  'assets/js/tracking.js',
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
];

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

if (!process.exitCode) {
  console.log('Static frontend build check passed.');
}
