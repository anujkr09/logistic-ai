const { Shipment, Warehouse, Notification, User } = require('./models');
const { getIo } = require('../sockets/instance');

function locationText(location) {
  if (!location) return '';
  return location.text || [location.city, location.country].filter(Boolean).join(', ') || '';
}

function latestProgress(shipment) {
  const history = Array.isArray(shipment.history) ? shipment.history : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const progress = Number(history[index]?.meta?.autoProgress);
    if (Number.isFinite(progress)) return progress;
  }
  return 0;
}

function hoursSince(value) {
  if (!value) return 0;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, (Date.now() - date.getTime()) / (1000 * 60 * 60));
}

function scoreShipmentFraud(shipment) {
  const history = Array.isArray(shipment.history) ? shipment.history : [];
  const status = String(shipment.status || '').toLowerCase();
  const tracking = String(shipment.trackingNumber || '').toUpperCase();
  const origin = locationText(shipment.origin).toLowerCase();
  const destination = locationText(shipment.destination).toLowerCase();
  const current = locationText(shipment.currentLocation).toLowerCase();

  let score = 5;
  const alerts = [];

  const delayedScans = history.filter((entry) => String(entry.status || '').toLowerCase().includes('delay')).length;
  if (delayedScans >= 2 || status.includes('delay')) {
    score += 28;
    alerts.push('Repeated delay scans detected');
  }

  if (shipment.estimatedDelivery && new Date(shipment.estimatedDelivery) < new Date() && status !== 'delivered') {
    score += 24;
    alerts.push('ETA window has passed but parcel is not delivered');
  }

  if (tracking.includes('FAKE') || tracking.includes('TEST-FRAUD')) {
    score += 45;
    alerts.push('Tracking number pattern is suspicious');
  }

  const duplicateStatuses = history.reduce((count, entry, index) => {
    if (index === 0) return count;
    return count + (entry.status === history[index - 1].status ? 1 : 0);
  }, 0);
  if (duplicateStatuses >= 3) {
    score += 18;
    alerts.push('Repeated identical scans may indicate stale or replayed tracking events');
  }

  const lastHistoryAt = history[history.length - 1]?.at || shipment.updatedAt;
  if (hoursSince(lastHistoryAt) > 48 && status !== 'delivered') {
    score += 16;
    alerts.push('No fresh scan for more than 48 hours');
  }

  const progress = latestProgress(shipment);
  if (progress > 75 && current && destination && !current.includes(destination.split(',')[0]?.trim())) {
    score += 8;
    alerts.push('Route progress is high but current scan is not near destination text');
  }

  if (origin && destination && origin === destination) {
    score += 10;
    alerts.push('Origin and destination look identical');
  }

  score = Math.min(100, Math.round(score));
  return {
    isFlagged: score >= 45,
    riskScore: score,
    alerts: alerts.length ? alerts : ['No major fraud signal detected'],
  };
}

function fraudMessage(shipment, fraud) {
  const reasons = Array.isArray(fraud?.alerts) && fraud.alerts.length
    ? fraud.alerts.join('; ')
    : 'Suspicious activity detected';
  return `Possible fraud on shipment ${shipment.trackingNumber}: ${reasons}. Risk score ${fraud?.riskScore || 0}%.`;
}

function emitNotification(notification) {
  try {
    const io = getIo();
    const payload = { notification };
    io.to(`company:${notification.companyId}`).emit('notification:new', payload);
    if (notification.userId) io.to(`user:${notification.userId}`).emit('notification:new', payload);
  } catch (error) {
    // Socket may not be initialized in scripts/tests; DB notification is still saved.
  }
}

async function createFraudNotification({ companyId, userId = null, audience, shipment, fraud, title, message }) {
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const exists = await Notification.findOne({
    companyId,
    userId,
    type: 'fraud_alert',
    'meta.trackingNumber': shipment.trackingNumber,
    'meta.audience': audience,
    createdAt: { $gte: since },
  }).exec();

  if (exists) return exists;

  const notification = await Notification.create({
    companyId,
    userId,
    type: 'fraud_alert',
    title,
    message,
    meta: {
      audience,
      trackingNumber: shipment.trackingNumber,
      riskScore: fraud?.riskScore || 0,
      alerts: fraud?.alerts || [],
    },
  });

  emitNotification(notification);
  return notification;
}

async function publishFraudNotifications(shipment, fraud, options = {}) {
  if (!shipment || !fraud?.isFlagged) return { adminNotifications: 0, customerNotifications: 0 };

  const companyId = shipment.companyId;
  const message = options.message || fraudMessage(shipment, fraud);
  const adminTitle = options.adminTitle || `Fraud alert: ${shipment.trackingNumber}`;
  const customerTitle = options.customerTitle || `Security alert for ${shipment.trackingNumber}`;

  const admins = await User.find({
    companyId,
    status: 'active',
    role: { $in: ['admin', 'warehouse_manager'] },
  }).select('_id').exec();

  const customerQuery = {
    companyId,
    status: 'active',
    role: 'customer',
  };
  if (shipment.customerId) customerQuery._id = shipment.customerId;

  const customers = await User.find(customerQuery).select('_id').exec();

  const adminNotifications = await Promise.all(admins.map((admin) => createFraudNotification({
    companyId,
    userId: admin._id,
    audience: 'admin',
    shipment,
    fraud,
    title: adminTitle,
    message,
  })));

  const customerNotifications = await Promise.all(customers.map((customer) => createFraudNotification({
    companyId,
    userId: customer._id,
    audience: 'customer',
    shipment,
    fraud,
    title: customerTitle,
    message,
  })));

  return {
    adminNotifications: adminNotifications.length,
    customerNotifications: customerNotifications.length,
  };
}

async function scanFraudForCompany(companyId, { persist = true } = {}) {
  const shipments = await Shipment.find({ companyId }).sort({ updatedAt: -1 }).limit(200).exec();
  const flagged = [];

  for (const shipment of shipments) {
    const fraud = scoreShipmentFraud(shipment);
    if (persist && (fraud.isFlagged || shipment.fraud?.isFlagged)) {
      shipment.fraud = fraud;
      await shipment.save();

      if (fraud.isFlagged) {
        flagged.push(shipment);
        await publishFraudNotifications(shipment, fraud);
      }
    } else if (fraud.isFlagged) {
      flagged.push(shipment);
    }
  }

  return { scanned: shipments.length, flagged };
}

function recommendationFromShipment(shipment, warehouses) {
  const fraud = scoreShipmentFraud(shipment);
  const progress = latestProgress(shipment);
  const etaLate = shipment.estimatedDelivery && new Date(shipment.estimatedDelivery) < new Date() && shipment.status !== 'Delivered';

  if (fraud.isFlagged) {
    return {
      id: `fraud-${shipment._id}`,
      type: 'fraud',
      trackingNumber: shipment.trackingNumber,
      title: `Verify ${shipment.trackingNumber} before delivery`,
      details: fraud.alerts.join('; '),
      score: fraud.riskScore,
      priority: 'High',
    };
  }

  if (etaLate) {
    return {
      id: `delay-${shipment._id}`,
      type: 'delay',
      trackingNumber: shipment.trackingNumber,
      title: `Escalate delayed shipment ${shipment.trackingNumber}`,
      details: 'ETA has passed. Notify customer and prioritize the next hub scan.',
      score: 88,
      priority: 'High',
    };
  }

  if (!shipment.warehouseId && warehouses.length) {
    const warehouse = warehouses[0];
    return {
      id: `warehouse-${shipment._id}`,
      type: 'warehouse',
      trackingNumber: shipment.trackingNumber,
      title: `Assign ${shipment.trackingNumber} to ${warehouse.name}`,
      details: `Nearest available warehouse profile: ${warehouse.city || warehouse.country || warehouse.name}. This reduces manual routing gaps.`,
      score: 82,
      priority: 'Medium',
      warehouseId: String(warehouse._id),
    };
  }

  if (progress > 70 && shipment.status !== 'Delivered') {
    return {
      id: `lastmile-${shipment._id}`,
      type: 'last_mile',
      trackingNumber: shipment.trackingNumber,
      title: `Prepare last-mile handoff for ${shipment.trackingNumber}`,
      details: 'Route progress is high. Keep destination hub capacity ready for dispatch.',
      score: 76,
      priority: 'Medium',
    };
  }

  return null;
}

async function buildRecommendations(companyId) {
  const [shipments, warehouses] = await Promise.all([
    Shipment.find({ companyId, status: { $ne: 'Delivered' } }).sort({ updatedAt: -1 }).limit(80).exec(),
    Warehouse.find({ companyId }).sort({ updatedAt: -1 }).limit(10).exec(),
  ]);

  const recommendations = shipments
    .map((shipment) => recommendationFromShipment(shipment, warehouses))
    .filter(Boolean)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 12);

  if (!recommendations.length && warehouses.length) {
    recommendations.push(...warehouses.slice(0, 3).map((warehouse, index) => ({
      id: `warehouse-${warehouse._id}`,
      type: 'capacity',
      title: `Use ${warehouse.name} for local fulfillment`,
      details: `Warehouse in ${warehouse.city || warehouse.country || 'your region'} is ready for next-mile distribution.`,
      score: 78 - index * 8,
      priority: 'Low',
      warehouseId: String(warehouse._id),
    })));
  }

  if (!recommendations.length) {
    recommendations.push({
      id: 'setup-warehouses',
      type: 'setup',
      title: 'Add warehouses to unlock routing recommendations',
      details: 'Create at least one warehouse and active shipment. AI will suggest assignments, delay actions, and fraud checks automatically.',
      score: 60,
      priority: 'Setup',
    });
  }

  return recommendations;
}

module.exports = { scoreShipmentFraud, scanFraudForCompany, buildRecommendations, publishFraudNotifications };
