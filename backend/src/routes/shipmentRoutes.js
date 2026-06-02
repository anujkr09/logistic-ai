const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { Shipment, Warehouse, Driver, Vehicle } = require('../services/models');
const { predictEta, detectFraud, analyzeTracking } = require('../services/aiClient');
const { scoreShipmentFraud, publishFraudNotifications } = require('../services/operationsIntelligence');
const { refreshRevenueSummary } = require('../services/analyticsSummary');
const { getIo } = require('../sockets/instance');
const { findShipment } = require('../services/trackingLookup');
const { PROFESSIONAL_STATUSES, normalizeStatus, computeLogistics, enrichShipment } = require('../services/logisticsEngine');
const { createAndDispatchNotification } = require('../services/notificationDispatcher');
const { auditAction } = require('../middleware/securityMiddleware');
const { routeRisk } = require('../services/routeIntelligence');
const { buildPdf } = require('../services/pdfDocument');

function parseDimensions(value = {}) {
  if (!value) value = {};
  if (typeof value === 'string') {
    const [length, width, height] = value.split(/[x*]/i).map((item) => Number(item.trim()));
    return { length: length || 0, width: width || 0, height: height || 0, unit: 'cm' };
  }
  return {
    length: Number(value.length || 0),
    width: Number(value.width || 0),
    height: Number(value.height || 0),
    unit: value.unit || 'cm',
  };
}

function shipmentPayload(body = {}) {
  const customerName = body.customerName || body.sender?.name || '';
  const customerPhone = body.customerPhone || body.sender?.phone || '';
  const customerEmail = body.customerEmail || body.sender?.email || '';
  const pickupAddress = body.pickupAddress || body.sender?.address || body.origin?.text || '';
  const deliveryAddress = body.deliveryAddress || body.receiver?.address || body.destination?.text || '';

  return {
    shipmentType: body.shipmentType || 'Standard',
    priority: body.priority || 'Normal',
    weight: Number(body.packageWeight ?? body.weight ?? 0),
    dimensions: parseDimensions(body.dimensions),
    packageCount: Math.max(1, Number(body.packageCount || 1)),
    sender: {
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
      address: pickupAddress,
      contactName: body.pickupContact || body.sender?.contactName || customerName,
    },
    receiver: {
      name: body.receiverName || body.receiver?.name || '',
      phone: body.receiverPhone || body.receiver?.phone || '',
      email: body.receiverEmail || body.receiver?.email || '',
      address: deliveryAddress,
    },
    driver: {
      name: body.assignedDriver || body.driver?.name || '',
      phone: body.driverPhone || body.driver?.phone || '',
      licenseNumber: body.licenseNumber || body.driver?.licenseNumber || '',
      status: body.driverStatus || body.driver?.status || 'Assigned',
    },
    vehicle: {
      number: body.assignedVehicle || body.vehicleNumber || body.vehicle?.number || '',
      type: body.vehicleType || body.vehicle?.type || '',
      fuelStatus: body.fuelStatus || body.vehicle?.fuelStatus || 'Operational',
      speedKmph: Number(body.speedKmph || body.vehicle?.speedKmph || 0),
    },
    gpsDeviceId: body.gpsDeviceId || '',
    routeCode: body.route || body.routeCode || '',
    expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : null,
  };
}

function textDocument(title, shipment) {
  const data = enrichShipment(shipment);
  return [
    title,
    `Tracking Number: ${data.trackingNumber}`,
    `Status: ${data.status}`,
    `Origin: ${data.origin?.text || '-'}`,
    `Destination: ${data.destination?.text || '-'}`,
    `Current Location: ${data.currentLocation?.text || '-'}`,
    `Estimated Delivery: ${data.estimatedDelivery || '-'}`,
    `Delivery Confidence: ${data.logistics?.deliveryConfidence || 0}%`,
    `Distance Covered: ${data.logistics?.coveredDistanceKm || 0} KM`,
    `Distance Remaining: ${data.logistics?.remainingDistanceKm || 0} KM`,
    `Driver: ${data.driver?.name || 'Unassigned'}`,
    `Vehicle: ${data.vehicle?.number || 'Unassigned'}`,
  ].join('\n');
}

// Public tracking by tracking number
router.get('/track/:trackingNumber', async (req, res) => {
  const { trackingNumber } = req.params;
  const { shipment, candidates } = await findShipment({ trackingNumber });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
  const data = enrichShipment(shipment);
  data.aiInsights = await analyzeTracking({ shipment: data });
  data.routeIntelligence = await routeRisk(data);
  data.lookup = { requestedTracking: trackingNumber, tried: candidates };
  res.json(data);
});

// Customer: shipment history
router.get('/', requireAuth, async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const q = { companyId: req.user.companyId };
  if (status) q.status = normalizeStatus(status);

  const p = Number(page);
  const l = Number(limit);

  const [items, total] = await Promise.all([
    Shipment.find(q).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).exec(),
    Shipment.countDocuments(q),
  ]);

  const enriched = items.map((item) => enrichShipment(item));
  res.json({ items: enriched, shipments: enriched, page: p, limit: l, total, statuses: PROFESSIONAL_STATUSES });
});

// Admin/Warehouse manager: create a shipment
router.post('/', requireAuth, requireRole(['admin', 'warehouse_manager']), auditAction('shipment.create', 'shipment'), async (req, res) => {
  const { trackingNumber, origin, destination, currentLocation, status, warehouseId } = req.body || {};
  if (!origin?.text || !destination?.text) return res.status(400).json({ message: 'origin.text and destination.text required' });

  const finalTrackingNumber = String(trackingNumber || `ZQ-${Date.now()}`).trim().toUpperCase();
  const existing = await Shipment.findOne({ trackingNumber: finalTrackingNumber }).exec();
  if (existing) return res.status(409).json({ message: 'Tracking number already exists' });

  const metadata = shipmentPayload(req.body || {});
  const shipment = await Shipment.create({
    companyId: req.user.companyId,
    customerId: req.user.role === 'customer' ? req.user.id : null,
    warehouseId: warehouseId || null,
    trackingNumber: finalTrackingNumber,
    origin: { text: String(origin.text).trim(), city: origin.city || '', country: origin.country || '', coordinates: origin.coordinates || undefined },
    destination: { text: String(destination.text).trim(), city: destination.city || '', country: destination.country || '', coordinates: destination.coordinates || undefined },
    currentLocation: currentLocation ? { text: currentLocation.text || '', city: currentLocation.city || '', country: currentLocation.country || '', coordinates: currentLocation.coordinates || undefined } : { ...origin },
    status: normalizeStatus(status || 'Shipment Created'),
    ...metadata,
    history: [],
  });

  shipment.history.push({
    status: shipment.status,
    location: { ...shipment.currentLocation },
    description: 'Shipment record created and pickup validation started.',
    meta: { createdAt: new Date().toISOString(), autoProgress: 6 },
  });

  const eta = await predictEta({ origin: shipment.origin, destination: shipment.destination, delayHistory: shipment.history });
  const logistics = computeLogistics(shipment);
  shipment.logistics = { ...(shipment.logistics || {}), ...logistics };
  shipment.estimatedDelivery = metadata.expectedDeliveryDate || (eta?.estimatedDelivery ? new Date(eta.estimatedDelivery) : new Date(logistics.estimatedDelivery));

  const fraud = scoreShipmentFraud(shipment);
  shipment.fraud = fraud;

  await shipment.save();

  if (shipment.driver?.name) {
    await Driver.findOneAndUpdate(
      { companyId: req.user.companyId, name: shipment.driver.name },
      {
        $set: {
          companyId: req.user.companyId,
          name: shipment.driver.name,
          phone: shipment.driver.phone || '',
          vehicleNumber: shipment.vehicle?.number || '',
          vehicleType: shipment.vehicle?.type || '',
          licenseNumber: shipment.driver.licenseNumber || '',
          currentStatus: 'Assigned',
          availability: false,
        },
        $addToSet: { assignedShipments: shipment.trackingNumber },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();
  }

  if (shipment.vehicle?.number) {
    await Vehicle.findOneAndUpdate(
      { companyId: req.user.companyId, vehicleNumber: shipment.vehicle.number },
      {
        $set: {
          companyId: req.user.companyId,
          vehicleNumber: shipment.vehicle.number,
          driverName: shipment.driver?.name || '',
          vehicleType: shipment.vehicle?.type || 'Truck',
          currentLocation: shipment.currentLocation,
          fuelStatus: shipment.vehicle?.fuelStatus || 'Operational',
          speedKmph: shipment.vehicle?.speedKmph || shipment.logistics?.averageSpeedKmph || 0,
          route: shipment.routeCode || '',
          eta: shipment.estimatedDelivery || null,
          lastGpsUpdate: shipment.logistics?.lastGpsPingAt || new Date(),
          status: 'Assigned',
        },
        $addToSet: { assignedShipments: shipment.trackingNumber },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();
  }

  const notification = await createAndDispatchNotification({
    companyId: req.user.companyId,
    userId: null,
    type: 'shipment_update',
    title: `Shipment ${shipment.trackingNumber} created`,
    message: `New shipment created from ${shipment.origin.text || 'origin'} to ${shipment.destination.text || 'destination'}`,
    meta: { trackingNumber: shipment.trackingNumber, event: 'Shipment Created' },
  });

  const io = getIo();
  if (fraud.isFlagged) {
    await publishFraudNotifications(shipment, fraud);
  }
  await refreshRevenueSummary(req.user.companyId);
  io.to(`company:${req.user.companyId}`).emit('shipment:created', { shipment });
  io.to(`company:${req.user.companyId}`).emit('shipment:update', { shipment, notification });

  res.status(201).json({ shipment: enrichShipment(shipment), notification });
});

// Admin/Warehouse manager: assign shipment to warehouse + update current location
router.post('/assign', requireAuth, requireRole(['admin', 'warehouse_manager']), auditAction('shipment.assign', 'shipment'), async (req, res) => {
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

  const nextStatus = status ? normalizeStatus(status) : normalizeStatus(shipment.status);
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
    description: `Shipment assigned to ${warehouse.name} and scan recorded.`,
    meta: { assignedAt: new Date().toISOString(), autoProgress: computeLogistics(shipment).progressPercent },
  });

  const eta = await predictEta({ origin: shipment.origin, destination: shipment.destination, delayHistory: shipment.history });
  const assignedLogistics = computeLogistics(shipment);
  shipment.logistics = { ...(shipment.logistics || {}), ...assignedLogistics };
  if (eta?.estimatedDelivery) shipment.estimatedDelivery = new Date(eta.estimatedDelivery);
  else if (assignedLogistics.estimatedDelivery) shipment.estimatedDelivery = new Date(assignedLogistics.estimatedDelivery);

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

  const notification = await createAndDispatchNotification({
    companyId: req.user.companyId,
    userId: null,
    type: 'shipment_update',
    title: `Shipment ${shipment.trackingNumber} updated`,
    message: `Status changed to ${shipment.status}`,
    meta: { trackingNumber: shipment.trackingNumber, warehouseId: warehouse._id, event: shipment.status },
  });

  const io = getIo();
  if (fraud.isFlagged) {
    await publishFraudNotifications(shipment, fraud);
  }
  await refreshRevenueSummary(req.user.companyId);
  io.to(`company:${req.user.companyId}`).emit('shipment:update', { shipment, notification });
  io.to(`tracking:${shipment.trackingNumber}`).emit('shipment:update', { shipment, notification });

  res.json({ shipment: enrichShipment(shipment), notification });
});

// Admin/Warehouse manager: update shipment status without changing customer tracking flow
router.patch('/status', requireAuth, requireRole(['admin', 'warehouse_manager']), auditAction('shipment.status.update', 'shipment'), async (req, res) => {
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

  shipment.status = normalizeStatus(status);
  shipment.history.push({
    status: shipment.status,
    location: {
      text: shipment.currentLocation.text,
      city: shipment.currentLocation.city,
      country: shipment.currentLocation.country,
      coordinates: shipment.currentLocation.coordinates,
    },
    description: `Status updated to ${shipment.status}.`,
    meta: { statusUpdatedAt: new Date().toISOString(), updatedBy: req.user.id, autoProgress: computeLogistics(shipment).progressPercent },
  });

  const eta = await predictEta({ origin: shipment.origin, destination: shipment.destination, delayHistory: shipment.history });
  const statusLogistics = computeLogistics(shipment);
  shipment.logistics = { ...(shipment.logistics || {}), ...statusLogistics };
  if (eta?.estimatedDelivery) shipment.estimatedDelivery = new Date(eta.estimatedDelivery);
  else if (statusLogistics.estimatedDelivery) shipment.estimatedDelivery = new Date(statusLogistics.estimatedDelivery);

  const fraud = scoreShipmentFraud(shipment);
  shipment.fraud = fraud;

  await shipment.save();

  const notification = await createAndDispatchNotification({
    companyId: req.user.companyId,
    userId: null,
    type: 'shipment_update',
    title: `Shipment ${shipment.trackingNumber} status updated`,
    message: `Status changed to ${shipment.status}`,
    meta: { trackingNumber: shipment.trackingNumber, event: shipment.status },
  });

  const io = getIo();
  if (fraud.isFlagged) {
    await publishFraudNotifications(shipment, fraud);
  }
  await refreshRevenueSummary(req.user.companyId);
  io.to(`company:${req.user.companyId}`).emit('shipment:update', { shipment, notification });
  io.to(`tracking:${shipment.trackingNumber}`).emit('shipment:update', { shipment, notification });

  res.json({ shipment: enrichShipment(shipment), notification });
});

router.get('/:trackingNumber/documents/:documentType', async (req, res) => {
  const { trackingNumber, documentType } = req.params;
  const { shipment } = await findShipment({ trackingNumber });
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });

  const allowed = new Set(['tracking-report', 'invoice', 'manifest', 'shipping-label', 'proof-of-delivery', 'print-tracking-report']);
  if (!allowed.has(documentType)) return res.status(404).json({ message: 'Document not found' });

  const title = documentType.split('-').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
  const lines = textDocument(title, shipment).split('\n');
  const pdf = buildPdf(title, lines);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${shipment.trackingNumber}-${documentType}.pdf"`);
  return res.send(pdf);
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
  const enriched = items.map((item) => enrichShipment(item));
  res.json({
    total,
    delayed,
    delivered,
    items: enriched,
    shipments: enriched,
    totalShipments: total,
    delayedShipments: delayed,
    deliveredShipments: delivered,
    statuses: PROFESSIONAL_STATUSES,
  });
});

module.exports = router;


