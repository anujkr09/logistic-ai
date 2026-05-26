const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { Shipment, Warehouse, Notification } = require('../services/models');
const { predictEta, detectFraud, analyzeTracking } = require('../services/aiClient');
const { scoreShipmentFraud, publishFraudNotifications } = require('../services/operationsIntelligence');
const { getIo } = require('../sockets/instance');
const { findShipment } = require('../services/trackingLookup');

// Public tracking by tracking number
router.get('/track/:trackingNumber', async (req, res) => {
  const { trackingNumber } = req.params;
  const { shipment, candidates } = await findShipment({ trackingNumber });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  const data = shipment.toObject();
  data.aiInsights = await analyzeTracking({ shipment: data });
  data.lookup = { requestedTracking: trackingNumber, tried: candidates };
  res.json(data);
});

// Customer: shipment history
router.get('/', requireAuth, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const q = { companyId: req.user.companyId };
  if (status) q.status = String(status);

  const p = Number(page);
  const l = Number(limit);

  const [items, total] = await Promise.all([
    Shipment.find(q).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).exec(),
    Shipment.countDocuments(q),
  ]);

  res.json({ items, shipments: items, page: p, limit: l, total });
});

// Admin/Warehouse manager: create a shipment
router.post('/', requireAuth, requireRole(['admin', 'warehouse_manager']), async (req, res) => {
  const { trackingNumber, origin, destination, currentLocation, status, warehouseId } = req.body || {};
  if (!origin?.text || !destination?.text) return res.status(400).json({ message: 'origin.text and destination.text required' });

  const finalTrackingNumber = String(trackingNumber || `SX-${Date.now()}`).trim().toUpperCase();
  const existing = await Shipment.findOne({ trackingNumber: finalTrackingNumber }).exec();
  if (existing) return res.status(409).json({ message: 'Tracking number already exists' });

  const shipment = await Shipment.create({
    companyId: req.user.companyId,
    customerId: req.user.role === 'customer' ? req.user.id : null,
    warehouseId: warehouseId || null,
    trackingNumber: finalTrackingNumber,
    origin: { text: String(origin.text).trim(), city: origin.city || '', country: origin.country || '', coordinates: origin.coordinates || undefined },
    destination: { text: String(destination.text).trim(), city: destination.city || '', country: destination.country || '', coordinates: destination.coordinates || undefined },
    currentLocation: currentLocation ? { text: currentLocation.text || '', city: currentLocation.city || '', country: currentLocation.country || '', coordinates: currentLocation.coordinates || undefined } : { ...origin },
    status: status ? String(status) : 'Created',
    history: [],
  });

  shipment.history.push({
    status: shipment.status,
    location: { ...shipment.currentLocation },
    meta: { createdAt: new Date().toISOString() },
  });

  const eta = await predictEta({ origin: shipment.origin, destination: shipment.destination, delayHistory: shipment.history });
  if (eta?.estimatedDelivery) shipment.estimatedDelivery = new Date(eta.estimatedDelivery);

  const fraud = scoreShipmentFraud(shipment);
  shipment.fraud = fraud;

  await shipment.save();

  const notification = await Notification.create({
    companyId: req.user.companyId,
    userId: null,
    type: 'shipment_update',
    title: `Shipment ${shipment.trackingNumber} created`,
    message: `New shipment created from ${shipment.origin.text || 'origin'} to ${shipment.destination.text || 'destination'}`,
    meta: { trackingNumber: shipment.trackingNumber },
  });

  const io = getIo();
  if (fraud.isFlagged) {
    await publishFraudNotifications(shipment, fraud);
  }
  io.to(`company:${req.user.companyId}`).emit('shipment:created', { shipment });
  io.to(`company:${req.user.companyId}`).emit('shipment:update', { shipment, notification });

  res.status(201).json({ shipment, notification });
});

// Admin/Warehouse manager: assign shipment to warehouse + update current location
router.post('/assign', requireAuth, requireRole(['admin', 'warehouse_manager']), async (req, res) => {
  const { trackingNumber, warehouseId, currentLocation, status } = req.body || {};
  if (!trackingNumber || !warehouseId) return res.status(400).json({ message: 'trackingNumber, warehouseId required' });

  const warehouse = await Warehouse.findOne({ _id: warehouseId, companyId: req.user.companyId }).exec();
  if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });

  const shipment = await Shipment.findOne({ trackingNumber, companyId: req.user.companyId }).exec();
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });

  if (currentLocation) {
    shipment.currentLocation = {
      text: currentLocation.text || shipment.currentLocation.text,
      city: currentLocation.city || shipment.currentLocation.city,
      country: currentLocation.country || shipment.currentLocation.country,
      coordinates: currentLocation.coordinates || shipment.currentLocation.coordinates,
    };
  }

  const nextStatus = status ? String(status) : shipment.status;
  shipment.status = nextStatus;
  shipment.warehouseId = warehouse._id;

  shipment.history.push({
    status: nextStatus,
    location: {
      text: shipment.currentLocation.text,
      city: shipment.currentLocation.city,
      country: shipment.currentLocation.country,
      coordinates: shipment.currentLocation.coordinates,
    },
    meta: { assignedAt: new Date().toISOString() },
  });

  const eta = await predictEta({ origin: shipment.origin, destination: shipment.destination, delayHistory: shipment.history });
  if (eta?.estimatedDelivery) shipment.estimatedDelivery = new Date(eta.estimatedDelivery);

  const aiFraud = await detectFraud({ trackingNumber: shipment.trackingNumber, history: shipment.history });
  let fraud = scoreShipmentFraud(shipment);
  if (aiFraud?.fraud) {
    shipment.fraud = {
      isFlagged: true,
      riskScore: Math.max(aiFraud.riskScore || 0, fraud.riskScore || 0),
      alerts: aiFraud.alerts || fraud.alerts || ['Fraud risk detected'],
    };
    fraud = shipment.fraud;
  } else {
    shipment.fraud = fraud;
  }

  await shipment.save();

  const notification = await Notification.create({
    companyId: req.user.companyId,
    userId: null,
    type: 'shipment_update',
    title: `Shipment ${shipment.trackingNumber} updated`,
    message: `Status changed to ${shipment.status}`,
    meta: { trackingNumber: shipment.trackingNumber, warehouseId: warehouse._id },
  });

  const io = getIo();
  if (fraud.isFlagged) {
    await publishFraudNotifications(shipment, fraud);
  }
  io.to(`company:${req.user.companyId}`).emit('shipment:update', { shipment, notification });
  io.to(`tracking:${shipment.trackingNumber}`).emit('shipment:update', { shipment, notification });

  res.json({ shipment, notification });
});

// Admin/Warehouse manager: update shipment status without changing customer tracking flow
router.patch('/status', requireAuth, requireRole(['admin', 'warehouse_manager']), async (req, res) => {
  const { trackingNumber, status, currentLocation } = req.body || {};
  if (!trackingNumber || !status) return res.status(400).json({ message: 'trackingNumber and status required' });

  const shipment = await Shipment.findOne({
    trackingNumber: String(trackingNumber).trim(),
    companyId: req.user.companyId,
  }).exec();
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });

  if (currentLocation) {
    shipment.currentLocation = {
      text: currentLocation.text || shipment.currentLocation.text,
      city: currentLocation.city || shipment.currentLocation.city,
      country: currentLocation.country || shipment.currentLocation.country,
      coordinates: currentLocation.coordinates || shipment.currentLocation.coordinates,
    };
  }

  shipment.status = String(status);
  shipment.history.push({
    status: shipment.status,
    location: {
      text: shipment.currentLocation.text,
      city: shipment.currentLocation.city,
      country: shipment.currentLocation.country,
      coordinates: shipment.currentLocation.coordinates,
    },
    meta: { statusUpdatedAt: new Date().toISOString(), updatedBy: req.user.id },
  });

  const eta = await predictEta({ origin: shipment.origin, destination: shipment.destination, delayHistory: shipment.history });
  if (eta?.estimatedDelivery) shipment.estimatedDelivery = new Date(eta.estimatedDelivery);

  const fraud = scoreShipmentFraud(shipment);
  shipment.fraud = fraud;

  await shipment.save();

  const notification = await Notification.create({
    companyId: req.user.companyId,
    userId: null,
    type: 'shipment_update',
    title: `Shipment ${shipment.trackingNumber} status updated`,
    message: `Status changed to ${shipment.status}`,
    meta: { trackingNumber: shipment.trackingNumber },
  });

  const io = getIo();
  if (fraud.isFlagged) {
    await publishFraudNotifications(shipment, fraud);
  }
  io.to(`company:${req.user.companyId}`).emit('shipment:update', { shipment, notification });
  io.to(`tracking:${shipment.trackingNumber}`).emit('shipment:update', { shipment, notification });

  res.json({ shipment, notification });
});

// Admin: aggregated shipment lists
router.get('/admin', requireAuth, requireRole(['admin']), async (req, res) => {
  const { delayedOnly } = req.query;

  const base = { companyId: req.user.companyId };
  const q = { ...base };

  if (delayedOnly === 'true') {
    q.estimatedDelivery = { $lt: new Date() };
  }

  const [total, delayed, delivered] = await Promise.all([
    Shipment.countDocuments(base),
    Shipment.countDocuments({ ...base, estimatedDelivery: { $lt: new Date() }, status: { $ne: 'Delivered' } }),
    Shipment.countDocuments({ ...base, status: 'Delivered' }),
  ]);

  const items = await Shipment.find(q).sort({ createdAt: -1 }).limit(50).exec();
  res.json({ total, delayed, delivered, items, shipments: items, totalShipments: total, delayedShipments: delayed, deliveredShipments: delivered });
});

module.exports = router;


