const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { Warehouse, Shipment, Notification, Analytics } = require('../services/models');
const { validateLocation, predictEta, detectFraud, recommendRoute, analyzeTracking, chat } = require('../services/aiClient');

// NOTE: This is a minimal schema system to start making the UI dynamic.
// It returns JSON config for each page and provides a generic action dispatcher.

function safeUserCompany(req) {
  return req?.user?.companyId;
}

// Hardcoded schemas for now (keeps changes small). Can be moved to DB later.
const pageSchemas = {
  login: {
    page: 'login',
    title: 'Login',
    form: {
      id: 'loginForm',
      submitAction: { type: 'auth.login' },
      fields: [
        { name: 'companyName', label: 'Company', type: 'text', required: true, placeholder: 'Company name' },
        { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@company.com' },
        { name: 'password', label: 'Password', type: 'password', required: true, placeholder: '••••••••' },
      ],
    },
  },

  register: {
    page: 'register',
    title: 'Create account',
    form: {
      id: 'registerForm',
      submitAction: { type: 'auth.register' },
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Your full name' },
        { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@company.com' },
        { name: 'password', label: 'Password', type: 'password', required: true, placeholder: '••••••••' },
        { name: 'companyName', label: 'Company', type: 'text', required: true, placeholder: 'Company name' },
      ],
    },
  },

  tracking: {
    page: 'tracking',
    title: 'Tracking',
    trackingSearch: {
      formId: 'trackingForm',
      field: { name: 'trackingNumber', label: 'Tracking number', type: 'text', required: true, placeholder: 'e.g. SX-923847-IN' },
      submitAction: { type: 'shipment.track.public' },
    },
  },

  adminDashboard: {
    page: 'adminDashboard',
    title: 'Admin Dashboard',
    widgets: ['summary', 'fraudAlerts', 'aiRecommendations', 'shipmentsAdmin', 'createShipment'],
  },

  customerDashboard: {
    page: 'customerDashboard',
    title: 'Customer Dashboard',
    widgets: ['shipmentHistory', 'notifications', 'analytics', 'chatbot'],
  },

  warehouses: {
    page: 'warehouses',
    title: 'Warehouse Management',
    widgets: ['warehousesGrid', 'assignShipment'],
  },
};

router.get('/schema/:page', requireAuth, async (req, res) => {
  const page = String(req.params.page || '').trim();
  // allow auth pages without token? We'll still requireAuth for now for simplicity.
  const schema = pageSchemas[page];
  if (!schema) return res.status(404).json({ message: 'Schema not found' });
  res.json(schema);
});

// Public schema endpoints for login/register can be called without auth.
router.get('/public-schema/:page', async (req, res) => {
  const page = String(req.params.page || '').trim();
  const schema = pageSchemas[page];
  if (!schema) return res.status(404).json({ message: 'Schema not found' });
  res.json(schema);
});

router.post('/action', requireAuth, async (req, res) => {
  const { actionType, payload } = req.body || {};
  if (!actionType) return res.status(400).json({ message: 'actionType required' });

  const companyId = safeUserCompany(req);

  try {
    // Auth
    if (actionType === 'auth.login' || actionType === 'auth.register') {
      return res.status(400).json({ message: 'Auth actions should be called via existing /api/auth routes' });
    }

    // Tracking (public-ish, but we still requireAuth in this action dispatcher)
    if (actionType === 'shipment.track') {
      const { trackingNumber } = payload || {};
      if (!trackingNumber) return res.status(400).json({ message: 'trackingNumber required' });
      const shipment = await Shipment.findOne({ trackingNumber: String(trackingNumber).trim(), companyId }).exec();
      if (!shipment) return res.status(404).json({ message: 'Shipment not found' });
      const data = shipment.toObject();
      data.aiInsights = await analyzeTracking({ shipment: data });
      return res.json({ shipment: data });
    }

    // Customer shipments
    if (actionType === 'customer.shipments.list') {
      const { status, page = 1, limit = 20 } = payload || {};
      const q = { companyId };
      if (status) q.status = String(status);
      const p = Number(page);
      const l = Number(limit);
      const [items, total] = await Promise.all([
        Shipment.find(q).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).exec(),
        Shipment.countDocuments(q),
      ]);
      return res.json({ items, page: p, limit: l, total });
    }

    if (actionType === 'customer.notifications.list') {
      const { page = 1, limit = 50 } = payload || {};
      const p = Number(page);
      const l = Number(limit);
      const q = { companyId };
      const [items, total] = await Promise.all([
        Notification.find(q).sort({ createdAt: -1 }).skip((p - 1) * l).limit(l).exec(),
        Notification.countDocuments(q),
      ]);
      return res.json({ items, page: p, limit: l, total });
    }

    // Admin analytics summary
    if (actionType === 'admin.analytics.summary') {
      const { delayedOnly } = payload || {};
      const base = { companyId };
      const [total, delayed, delivered, revenueSummary] = await Promise.all([
        Shipment.countDocuments(base),
        Shipment.countDocuments({ ...base, estimatedDelivery: { $lt: new Date() }, status: { $ne: 'Delivered' } }),
        Shipment.countDocuments({ ...base, status: 'Delivered' }),
        // Placeholder revenue
        Promise.resolve({ revenue: 0 }),
      ]);
      return res.json({ totalShipments: total, delayedShipments: delayed, deliveredShipments: delivered, revenue: revenueSummary?.revenue || 0, delayedOnly: delayedOnly === 'true' });
    }

    // Fraud alerts
    if (actionType === 'admin.fraud.alerts') {
      const alerts = await Shipment.find({ companyId, 'fraud.isFlagged': true }).sort({ createdAt: -1 }).limit(20).exec();
      return res.json({ alerts: alerts.map((s) => ({
        title: `Fraud risk for ${s.trackingNumber}`,
        reason: s.fraud?.alerts?.join('; ') || 'Suspicious activity detected',
        riskScore: s.fraud?.riskScore || 0,
        status: s.status,
        trackingNumber: s.trackingNumber,
      })) });
    }

    // AI recommendations
    if (actionType === 'admin.ai.recommendations') {
      const warehouses = await Warehouse.find({ companyId }).sort({ createdAt: -1 }).limit(5).exec();
      const recommendations = warehouses.map((warehouse, index) => ({
        id: String(warehouse._id),
        title: `Use ${warehouse.name} for local fulfillment`,
        details: `Warehouse in ${warehouse.city || warehouse.country || 'your region'} is optimal for next-mile distribution.`,
        score: 100 - index * 10,
      }));
      return res.json({ recommendations });
    }

    // Warehouses list
    if (actionType === 'warehouses.list') {
      const items = await Warehouse.find({ companyId }).sort({ createdAt: -1 }).exec();
      return res.json({ items });
    }

    // Create shipment (admin/warehouse)
    if (actionType === 'shipment.create') {
      const { trackingNumber, origin, destination, status, warehouseId, currentLocation } = payload || {};
      if (!trackingNumber || !origin?.text || !destination?.text) return res.status(400).json({ message: 'trackingNumber, origin.text, destination.text required' });

      const existing = await Shipment.findOne({ trackingNumber: String(trackingNumber).trim(), companyId }).exec();
      if (existing) return res.status(409).json({ message: 'Tracking number already exists' });

      const shipment = await Shipment.create({
        companyId,
        warehouseId: warehouseId || null,
        trackingNumber: String(trackingNumber).trim(),
        origin: { text: origin.text, city: origin.city || '', country: origin.country || '', coordinates: origin.coordinates || undefined },
        destination: { text: destination.text, city: destination.city || '', country: destination.country || '', coordinates: destination.coordinates || undefined },
        currentLocation: currentLocation
          ? { text: currentLocation.text || '', city: currentLocation.city || '', country: currentLocation.country || '', coordinates: currentLocation.coordinates || undefined }
          : { text: destination.text, city: destination.city || '', country: destination.country || '', coordinates: destination.coordinates || undefined },
        status: status ? String(status) : 'Created',
        history: [],
      });

      shipment.history.push({
        status: shipment.status,
        location: { ...shipment.currentLocation },
        meta: { createdAt: new Date().toISOString() },
      });

      await shipment.save();
      return res.json({ shipment });
    }

    // Assign shipment to warehouse
    if (actionType === 'shipment.assign') {
      const { trackingNumber, warehouseId, currentLocation, status } = payload || {};
      if (!trackingNumber || !warehouseId) return res.status(400).json({ message: 'trackingNumber, warehouseId required' });

      // Reuse existing business logic through existing /api/shipments/assign endpoint.
      // For now, we implement direct logic for correctness.
      const warehouse = await Warehouse.findOne({ _id: warehouseId, companyId }).exec();
      if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });

      const shipment = await Shipment.findOne({ trackingNumber: String(trackingNumber).trim(), companyId }).exec();
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

      // AI enrich
      const eta = await predictEta({ origin: shipment.origin, destination: shipment.destination, delayHistory: shipment.history });
      if (eta?.estimatedDelivery) shipment.estimatedDelivery = new Date(eta.estimatedDelivery);

      const fraud = await detectFraud({ trackingNumber: shipment.trackingNumber, history: shipment.history });
      if (fraud?.fraud) {
        shipment.fraud = {
          isFlagged: true,
          riskScore: fraud.riskScore || 0,
          alerts: fraud.alerts || ['Fraud risk detected'],
        };
      }

      await shipment.save();

      return res.json({ shipment });
    }

    // AI chat
    if (actionType === 'ai.chat') {
      const { message, trackingNumber } = payload || {};
      if (!message) return res.status(400).json({ message: 'message required' });
      const ai = await chat({ message: String(message), trackingNumber: trackingNumber || null, companyId });
      return res.json({ reply: ai.reply });
    }

    // Shipments admin list (simple)
    if (actionType === 'admin.shipments.list') {
      const items = await Shipment.find({ companyId }).sort({ createdAt: -1 }).limit(100).exec();
      return res.json({ items });
    }

    return res.status(400).json({ message: `Unknown actionType: ${actionType}` });
  } catch (e) {
    return res.status(500).json({ message: e?.message || 'Action failed' });
  }
});

module.exports = router;

