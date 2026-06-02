const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'src');

const requiredFiles = [
  'src/app.js',
  'src/server.js',
  'src/middleware/errorMiddleware.js',
  'src/middleware/rateLimitMiddleware.js',
  'src/routes/authRoutes.js',
  'src/routes/workspaceRoutes.js',
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function collectJsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectJsFiles(fullPath);
    return entry.name.endsWith('.js') ? [fullPath] : [];
  });
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) fail(`Missing required backend file: ${file}`);
}

for (const file of collectJsFiles(sourceRoot)) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    fail(`Syntax check failed: ${path.relative(root, file)}\n${result.stderr || result.stdout}`);
  }
}

const appJs = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');
if (!appJs.includes('/runtime-config.js') || !appJs.includes('GOOGLE_MAPS_API_KEY')) {
  fail('Backend must expose runtime-config.js with public map config when serving frontend assets.');
}

const analyticsSummary = fs.readFileSync(path.join(root, 'src/services/analyticsSummary.js'), 'utf8');
const shipmentRoutes = fs.readFileSync(path.join(root, 'src/routes/shipmentRoutes.js'), 'utf8');
if (!analyticsSummary.includes('refreshRevenueSummary') || !shipmentRoutes.includes('refreshRevenueSummary')) {
  fail('Shipment writes must refresh revenue_summary analytics.');
}

if (!process.exitCode) {
  console.log('Static backend build check passed.');
}
