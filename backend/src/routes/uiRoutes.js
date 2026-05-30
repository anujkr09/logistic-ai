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

const servicePageSchemas = {
  'ship-now': {
    page: 'ship-now',
    title: 'Ship Now',
    kicker: 'Shipment desk',
    lead: 'Create a shipment from live account, route, and pickup data.',
    note: 'Choose package details, schedule collection, and hand off to dashboard workflows without rebuilding this page.',
    primaryAction: { label: 'Start shipping', href: './register.html' },
    secondaryAction: { label: 'Track shipment', href: './tracking.html' },
    metrics: [
      { value: '3 steps', label: 'details, pickup, confirm' },
      { value: 'AI ETA', label: 'dynamic route estimate' },
      { value: 'Live', label: 'dashboard sync' },
    ],
    cards: [
      { title: 'Package details', text: 'Capture origin, destination, weight, and service preference.' },
      { title: 'Pickup planning', text: 'Schedule collections and route handoff from the same workspace.' },
      { title: 'Status updates', text: 'Shipment state stays connected to tracking and notifications.' },
    ],
  },
  'rates-and-transit-times': {
    page: 'rates-and-transit-times',
    title: 'Rates and Transit Times',
    kicker: 'Route planning',
    lead: 'Compare service windows using operational data and AI confidence signals.',
    note: 'Dynamic content can be changed from this schema without editing the page markup.',
    primaryAction: { label: 'View transit options', href: './tracking.html' },
    secondaryAction: { label: 'Create shipment', href: './ship-now.html' },
    metrics: [
      { value: '4 modes', label: 'air, rail, road, last mile' },
      { value: 'ETA', label: 'AI-assisted planning' },
      { value: 'Risk', label: 'delay context' },
    ],
    cards: [
      { title: 'Transit windows', text: 'Show expected delivery bands for each movement option.' },
      { title: 'Cost context', text: 'Keep rate copy ready for backend pricing data.' },
      { title: 'Route confidence', text: 'Surface weather, distance, and delay signals.' },
    ],
  },
  'schedule-manage-pickups': {
    page: 'schedule-manage-pickups',
    title: 'Schedule and Manage Pickups',
    kicker: 'Pickup desk',
    lead: 'Coordinate pickup requests, edits, and handoffs from one dynamic view.',
    note: 'Connected dashboards can reuse the same pickup state as the public page.',
    primaryAction: { label: 'Manage pickups', href: './customer-dashboard.html' },
    secondaryAction: { label: 'Create shipment', href: './ship-now.html' },
    metrics: [
      { value: 'Today', label: 'pickup slots' },
      { value: 'Live', label: 'status updates' },
      { value: 'Hub', label: 'warehouse handoff' },
    ],
    cards: [
      { title: 'Slot selection', text: 'Show available collection windows by city or warehouse.' },
      { title: 'Reschedule flow', text: 'Make pickup edits without losing shipment context.' },
      { title: 'Driver handoff', text: 'Keep pickup status visible for operations teams.' },
    ],
  },
  ecommerce: {
    page: 'ecommerce',
    title: 'Ecommerce Shipping',
    kicker: 'Store operations',
    lead: 'Centralize online order movement, tracking, and customer notifications.',
    note: 'The page is now driven by schema and ready for store/channel data.',
    primaryAction: { label: 'Enable ecommerce', href: './register.html' },
    secondaryAction: { label: 'Open dashboard', href: './customer-dashboard.html' },
    metrics: [
      { value: 'Orders', label: 'ready for API sync' },
      { value: 'Labels', label: 'shipping workflow' },
      { value: 'Alerts', label: 'customer updates' },
    ],
    cards: [
      { title: 'Order intake', text: 'Prepare marketplace and storefront orders for fulfillment.' },
      { title: 'Fulfillment rules', text: 'Route orders by service, city, inventory, or warehouse.' },
      { title: 'Customer visibility', text: 'Send tracking updates and exception notices.' },
    ],
  },
  'packaging-shipping-supplies': {
    page: 'packaging-shipping-supplies',
    title: 'Packaging and Shipping Supplies',
    kicker: 'Packaging guide',
    lead: 'Serve dynamic packaging guidance by shipment type, risk, and destination.',
    note: 'Operations can later replace these schema cards with inventory-backed supplies.',
    primaryAction: { label: 'Prepare package', href: './ship-now.html' },
    secondaryAction: { label: 'Contact support', href: './contact.html' },
    metrics: [
      { value: 'Safe', label: 'handling guidance' },
      { value: 'Labels', label: 'address accuracy' },
      { value: 'Ready', label: 'pickup prep' },
    ],
    cards: [
      { title: 'Box selection', text: 'Match package size and protection to the shipment profile.' },
      { title: 'Label checks', text: 'Make addresses and tracking IDs easy to scan.' },
      { title: 'Handling notes', text: 'Capture fragile, cold-chain, or oversized instructions.' },
    ],
  },
  'quote-heavy-shipment': {
    page: 'quote-heavy-shipment',
    title: 'Quote Heavy Shipment',
    kicker: 'Freight planning',
    lead: 'Collect freight details and route signals for large or oversized shipments.',
    note: 'The dynamic schema keeps quote copy and cards editable from backend code.',
    primaryAction: { label: 'Request quote', href: './contact.html' },
    secondaryAction: { label: 'Plan route', href: './rates-and-transit-times.html' },
    metrics: [
      { value: 'Freight', label: 'oversized support' },
      { value: 'Hub', label: 'warehouse planning' },
      { value: 'Risk', label: 'AI review' },
    ],
    cards: [
      { title: 'Dimensions', text: 'Capture size, weight, handling, and loading constraints.' },
      { title: 'Route review', text: 'Compare freight movement options before booking.' },
      { title: 'Exception care', text: 'Flag risk, insurance, and customs requirements early.' },
    ],
  },
  'shipping-services': {
    page: 'shipping-services',
    title: 'Shipping Services',
    kicker: 'Service catalog',
    lead: 'Browse service options from a schema-driven catalog.',
    note: 'Add or change services centrally and this page updates without markup edits.',
    primaryAction: { label: 'View all services', href: './ship-now.html' },
    secondaryAction: { label: 'Compare transit', href: './rates-and-transit-times.html' },
    metrics: [
      { value: 'Domestic', label: 'parcel and freight' },
      { value: 'Global', label: 'cross-border ready' },
      { value: 'AI', label: 'routing context' },
    ],
    cards: [
      { title: 'Express', text: 'Fast parcel movement for urgent deliveries.' },
      { title: 'Standard', text: 'Reliable service for everyday shipments.' },
      { title: 'Freight', text: 'Support for heavy, palletized, and large movement.' },
    ],
  },
  'shipping-tools': {
    page: 'shipping-tools',
    title: 'Shipping Tools',
    kicker: 'Operations toolkit',
    lead: 'Use dynamic tools for tracking, pickup, routing, account, and warehouse workflows.',
    note: 'This page now renders reusable tool cards from data.',
    primaryAction: { label: 'View tools', href: './register.html' },
    secondaryAction: { label: 'Track shipment', href: './tracking.html' },
    metrics: [
      { value: 'Track', label: 'live shipment lookup' },
      { value: 'Plan', label: 'route and pickup' },
      { value: 'Manage', label: 'account workspace' },
    ],
    cards: [
      { title: 'Tracking', text: 'Find shipment status and AI delivery context.' },
      { title: 'Pickup manager', text: 'Coordinate package collection and changes.' },
      { title: 'Warehouse view', text: 'Connect shipments to inventory and hubs.' },
    ],
  },
  'zyraviq-one-stop-shop': {
    page: 'zyraviq-one-stop-shop',
    title: 'ZYRAVIQ One Stop Shop',
    kicker: 'Unified workspace',
    lead: 'Bring quotes, shipment creation, tracking, and support into one dynamic experience.',
    note: 'The visible page is now assembled from schema data and shared components.',
    primaryAction: { label: 'Explore services', href: './customer-dashboard.html' },
    secondaryAction: { label: 'Open account', href: './register.html' },
    metrics: [
      { value: 'One', label: 'workspace' },
      { value: 'Live', label: 'shipment context' },
      { value: 'AI', label: 'operational assist' },
    ],
    cards: [
      { title: 'Create', text: 'Start shipments and collect operational details.' },
      { title: 'Monitor', text: 'Track status, ETA, delay, and fraud signals.' },
      { title: 'Resolve', text: 'Use support and dashboards to handle exceptions.' },
    ],
  },
  contact: {
    page: 'contact',
    title: 'Contact ZYRAVIQ',
    kicker: 'Support center',
    lead: 'Get help with shipments, account access, pickup changes, and exceptions.',
    note: 'Support content is now dynamic and can be backed by tickets or CRM data later.',
    primaryAction: { label: 'Email support', href: 'mailto:support@zyraviqlogistics.example' },
    secondaryAction: { label: 'Track first', href: './tracking.html' },
    metrics: [
      { value: '24/7', label: 'tracking context' },
      { value: 'Fast', label: 'shipment lookup' },
      { value: 'Team', label: 'support routing' },
    ],
    cards: [
      { title: 'Shipment issue', text: 'Share tracking IDs so support can see current movement.' },
      { title: 'Account help', text: 'Resolve login, profile, company, and dashboard questions.' },
      { title: 'Operational support', text: 'Get help with pickups, freight, packaging, and delays.' },
    ],
  },
};

Object.assign(pageSchemas, servicePageSchemas);

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

