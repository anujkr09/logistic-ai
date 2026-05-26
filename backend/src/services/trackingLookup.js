const { Shipment } = require('./models');

function escapeRegex(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trackingCandidates(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return [];

  const compact = raw.replace(/\s+/g, '');
  const candidates = new Set([raw, compact]);
  const numeric = compact.match(/\d{4,}/)?.[0];

  if (numeric) {
    candidates.add(numeric);
    candidates.add(`SX-${numeric}`);
    candidates.add(`SHIPX-${numeric}`);
  }

  return [...candidates].filter(Boolean);
}

async function findShipment({ trackingNumber, companyId }) {
  const candidates = trackingCandidates(trackingNumber);
  if (!candidates.length) return { shipment: null, candidates };

  const base = companyId ? { companyId } : {};
  const exact = await Shipment.findOne({
    ...base,
    trackingNumber: { $in: candidates.map((item) => new RegExp(`^${escapeRegex(item)}$`, 'i')) },
  }).exec();

  if (exact) return { shipment: exact, candidates };

  const numeric = candidates.find((item) => /^\d{4,}$/.test(item));
  if (!numeric) return { shipment: null, candidates };

  const fuzzy = await Shipment.findOne({
    ...base,
    trackingNumber: { $regex: `${escapeRegex(numeric)}$`, $options: 'i' },
  }).sort({ updatedAt: -1 }).exec();

  return { shipment: fuzzy, candidates };
}

async function findShipmentForChat({ trackingNumber, companyId }) {
  return findShipment({ trackingNumber, companyId });
}

async function latestActiveShipment({ companyId }) {
  const base = companyId ? { companyId } : {};
  return Shipment.findOne({ ...base, status: { $ne: 'Delivered' } }).sort({ updatedAt: -1 }).exec();
}

module.exports = { findShipment, findShipmentForChat, latestActiveShipment, trackingCandidates };
