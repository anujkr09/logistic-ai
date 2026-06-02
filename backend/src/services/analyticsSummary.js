const { Analytics } = require('./models');

const STATUS_MULTIPLIER = {
  Created: 0.15,
  'In Transit': 0.45,
  Arrived: 0.7,
  'Out for Delivery': 0.9,
  Delivered: 1,
};

function readRevenue(payload = {}) {
  const value = payload.revenue ?? payload.totalRevenue ?? payload.amount ?? payload.total;
  const revenue = Number(value);
  return Number.isFinite(revenue) ? revenue : 0;
}

function coordinateDistanceKm(origin = {}, destination = {}) {
  const a = Array.isArray(origin.coordinates) ? origin.coordinates.map(Number) : [];
  const b = Array.isArray(destination.coordinates) ? destination.coordinates.map(Number) : [];
  if (a.length < 2 || b.length < 2 || !a.every(Number.isFinite) || !b.every(Number.isFinite)) return 0;

  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const toRad = (value) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function textDistanceFallback(origin = {}, destination = {}) {
  const routeText = [origin.text, origin.city, destination.text, destination.city].filter(Boolean).join(' ');
  if (!routeText) return 180;
  const seed = routeText.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 120 + (seed % 950);
}

function estimateShipmentRevenue(shipment) {
  const distance = coordinateDistanceKm(shipment.origin, shipment.destination) ||
    textDistanceFallback(shipment.origin, shipment.destination);
  const base = 149;
  const distanceCharge = Math.max(80, distance * 8.5);
  const riskCharge = shipment.fraud?.isFlagged ? 120 : 0;
  const statusMultiplier = STATUS_MULTIPLIER[shipment.status] ?? 0.35;
  return Math.round((base + distanceCharge + riskCharge) * statusMultiplier);
}

async function refreshRevenueSummary(companyId) {
  const { Shipment } = require('./models');
  const shipments = await Shipment.find({ companyId }).lean().exec();
  const revenue = shipments.reduce((sum, shipment) => sum + estimateShipmentRevenue(shipment), 0);
  const payload = {
    revenue,
    totalRevenue: revenue,
    shipmentCount: shipments.length,
    currency: 'INR',
    basis: 'estimated_from_route_distance_and_status',
  };
  const computedAt = new Date();

  const summary = await Analytics.findOneAndUpdate(
    { companyId, type: 'revenue_summary' },
    { $set: { payload, computedAt } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean().exec();

  return {
    revenue,
    computedAt: summary?.computedAt || computedAt,
    payload,
  };
}

async function getRevenueSummary(companyId) {
  const summary = await Analytics.findOne({ companyId, type: 'revenue_summary' })
    .sort({ computedAt: -1, updatedAt: -1, createdAt: -1 })
    .lean()
    .exec();

  return {
    revenue: readRevenue(summary?.payload),
    computedAt: summary?.computedAt || null,
  };
}

module.exports = { getRevenueSummary, refreshRevenueSummary, estimateShipmentRevenue };
