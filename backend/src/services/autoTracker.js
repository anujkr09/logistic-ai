const mongoose = require('mongoose');
const { Shipment, Notification } = require('./models');
const { getIo } = require('../sockets/instance');
const { buildTrackingInsights } = require('./trackingInsights');
const { scoreShipmentFraud } = require('./operationsIntelligence');

const DEFAULT_INTERVAL_MS = 20000;
const DEFAULT_STEP = 12;

const KNOWN_COORDINATES = [
  { match: ['mumbai', 'bombay'], coordinates: [72.8777, 19.076] },
  { match: ['delhi', 'new delhi', 'gurgaon', 'gurugram', 'noida'], coordinates: [77.1025, 28.7041] },
  { match: ['bengaluru', 'bangalore'], coordinates: [77.5946, 12.9716] },
  { match: ['hyderabad'], coordinates: [78.4867, 17.385] },
  { match: ['chennai'], coordinates: [80.2707, 13.0827] },
  { match: ['kolkata', 'calcutta'], coordinates: [88.3639, 22.5726] },
  { match: ['pune'], coordinates: [73.8567, 18.5204] },
  { match: ['ahmedabad'], coordinates: [72.5714, 23.0225] },
  { match: ['jaipur'], coordinates: [75.7873, 26.9124] },
  { match: ['lucknow'], coordinates: [80.9462, 26.8467] },
  { match: ['kanpur'], coordinates: [80.3319, 26.4499] },
  { match: ['surat'], coordinates: [72.8311, 21.1702] },
  { match: ['nagpur'], coordinates: [79.0882, 21.1458] },
  { match: ['indore'], coordinates: [75.8577, 22.7196] },
  { match: ['patna'], coordinates: [85.1376, 25.5941] },
  { match: ['bhopal'], coordinates: [77.4126, 23.2599] },
  { match: ['kochi', 'cochin'], coordinates: [76.2673, 9.9312] },
  { match: ['goa'], coordinates: [74.124, 15.2993] },
];

let timer = null;
let running = false;

function numberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeText(location) {
  return [location?.text, location?.city, location?.country].filter(Boolean).join(' ').toLowerCase();
}

function coordinatesFor(location) {
  const raw = Array.isArray(location?.coordinates) ? location.coordinates.map(Number) : [];
  if (raw.length >= 2 && raw.every(Number.isFinite)) return [raw[0], raw[1]];

  const text = normalizeText(location);
  const known = KNOWN_COORDINATES.find((item) => item.match.some((word) => text.includes(word)));
  if (known) return known.coordinates;

  const seedText = text || 'zyraviq route';
  let seed = 0;
  for (const char of seedText) seed = (seed + char.charCodeAt(0) * 17) % 997;

  return [
    Number((68.7 + (seed % 180) / 10).toFixed(4)),
    Number((8.2 + (seed % 260) / 10).toFixed(4)),
  ];
}

function interpolate(start, end, percent) {
  const ratio = Math.max(0, Math.min(100, percent)) / 100;
  return [
    Number((start[0] + (end[0] - start[0]) * ratio).toFixed(5)),
    Number((start[1] + (end[1] - start[1]) * ratio).toFixed(5)),
  ];
}

function previousProgress(shipment) {
  const history = Array.isArray(shipment.history) ? shipment.history : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const progress = Number(history[index]?.meta?.autoProgress);
    if (Number.isFinite(progress)) return progress;
  }

  const status = String(shipment.status || '').toLowerCase();
  if (status === 'delivered') return 100;
  if (status === 'out for delivery') return 88;
  if (status === 'arrived') return 70;
  if (status === 'in transit') return 30;
  return 0;
}

function statusForProgress(progress) {
  if (progress >= 100) return 'Delivered';
  if (progress >= 86) return 'Out for Delivery';
  if (progress >= 66) return 'Arrived';
  if (progress >= 12) return 'In Transit';
  return 'Created';
}

function progressLocationText(shipment, progress) {
  if (progress >= 100) return shipment.destination?.text || 'Delivered at destination';
  if (progress >= 86) return `AI dispatch scan: near ${shipment.destination?.city || shipment.destination?.text || 'destination'}`;
  if (progress >= 66) return `AI hub scan: ${Math.round(progress)}% route completed`;
  if (progress >= 12) return `AI route scan: ${Math.round(progress)}% in transit`;
  return shipment.origin?.text || 'Shipment created';
}

function estimatedDeliveryFor(progress) {
  if (progress >= 100) return new Date();
  const remaining = Math.max(1, 100 - progress);
  return new Date(Date.now() + remaining * 12 * 60 * 1000);
}

async function emitShipmentUpdate(shipment, notification) {
  const io = getIo();
  const data = typeof shipment.toObject === 'function' ? shipment.toObject() : shipment;
  data.aiInsights = buildTrackingInsights(data);
  io.to(`company:${shipment.companyId}`).emit('shipment:update', { shipment: data, notification });
  io.to(`tracking:${shipment.trackingNumber}`).emit('shipment:update', { shipment: data, notification });
}

async function createStatusNotification(shipment, oldStatus) {
  if (String(oldStatus) === String(shipment.status)) return null;

  return Notification.create({
    companyId: shipment.companyId,
    userId: null,
    type: 'shipment_update',
    title: `AI updated ${shipment.trackingNumber}`,
    message: `Auto tracker moved shipment to ${shipment.status}`,
    meta: { trackingNumber: shipment.trackingNumber, autoTracked: true },
  });
}

async function advanceShipment(shipment) {
  if (!shipment || String(shipment.status).toLowerCase() === 'delivered') return null;

  const step = numberOr(process.env.AUTO_TRACKER_STEP, DEFAULT_STEP);
  const oldStatus = shipment.status;
  const nextProgress = Math.min(100, previousProgress(shipment) + step);
  const originCoordinates = coordinatesFor(shipment.origin);
  const destinationCoordinates = coordinatesFor(shipment.destination);
  const nextCoordinates = interpolate(originCoordinates, destinationCoordinates, nextProgress);
  const nextStatus = statusForProgress(nextProgress);

  shipment.currentLocation = {
    text: progressLocationText(shipment, nextProgress),
    city: nextProgress >= 86 ? shipment.destination?.city || '' : shipment.currentLocation?.city || shipment.origin?.city || '',
    country: shipment.destination?.country || shipment.currentLocation?.country || shipment.origin?.country || 'India',
    coordinates: nextCoordinates,
  };
  shipment.status = nextStatus;
  shipment.estimatedDelivery = estimatedDeliveryFor(nextProgress);
  shipment.history.push({
    status: nextStatus,
    location: {
      text: shipment.currentLocation.text,
      city: shipment.currentLocation.city,
      country: shipment.currentLocation.country,
      coordinates: shipment.currentLocation.coordinates,
    },
    meta: {
      autoTracked: true,
      autoProgress: nextProgress,
      routeConfidence: 0.92,
      autoUpdatedAt: new Date().toISOString(),
    },
  });
  shipment.fraud = scoreShipmentFraud(shipment);

  await shipment.save();
  const notification = await createStatusNotification(shipment, oldStatus);
  await emitShipmentUpdate(shipment, notification);
  return shipment;
}

async function runAutoTracker() {
  if (running) return;
  if (mongoose.connection.readyState !== 1) return;
  running = true;

  try {
    const limit = Math.min(numberOr(process.env.AUTO_TRACKER_LIMIT, 30), 100);
    const shipments = await Shipment.find({ status: { $ne: 'Delivered' } })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .exec();

    for (const shipment of shipments) {
      await advanceShipment(shipment);
    }
  } catch (err) {
    console.error('AI auto tracker failed', err);
  } finally {
    running = false;
  }
}

function startAutoTracker() {
  if (process.env.AUTO_TRACKER_ENABLED === 'false' || timer) return;

  const intervalMs = numberOr(process.env.AUTO_TRACKER_INTERVAL_MS, DEFAULT_INTERVAL_MS);
  timer = setInterval(() => {
    runAutoTracker();
  }, intervalMs);
  if (typeof timer.unref === 'function') timer.unref();

  setTimeout(() => {
    runAutoTracker();
  }, 5000);

  console.log(`ZYRAVIQ AI auto tracker running every ${intervalMs}ms`);
}

module.exports = { startAutoTracker, runAutoTracker, advanceShipment };
