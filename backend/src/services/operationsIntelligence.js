const { Shipment, Warehouse, Notification, User, AuditLog } = require('./models');
const { getIo } = require('../sockets/instance');
const { routeRisk } = require('./routeIntelligence');

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

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(Number(value) || 0)));
}

function number(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function daysUntil(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return (date.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
}

function statusKey(value) {
  return String(value || '').trim().toLowerCase();
}

function warehouseLoad(warehouse) {
  const capacity = number(warehouse?.capacity);
  const occupancy = number(warehouse?.occupancy);
  if (capacity > 0 && occupancy <= capacity) return clamp((occupancy / capacity) * 100);
  return clamp(occupancy);
}

function routeRiskScore(risk = {}) {
  return clamp(
    number(risk.weather?.riskScore) * 0.45 +
    number(risk.traffic?.riskScore) * 0.35 +
    number(risk.road?.riskScore) * 0.20
  );
}

function routeDelayMinutes(risk = {}) {
  return clamp(
    number(risk.weather?.delayMinutes) +
    number(risk.traffic?.delayMinutes) +
    number(risk.road?.delayMinutes),
    0,
    600
  );
}

function shipmentFeatureVector(shipment, routeIntel, companyStats) {
  const progress = latestProgress(shipment);
  const etaDays = daysUntil(shipment.estimatedDelivery);
  const freshHours = hoursSince(shipment.history?.[shipment.history.length - 1]?.at || shipment.updatedAt);
  const logistics = shipment.logistics || {};
  const routeRiskValue = routeRiskScore(routeIntel);
  const status = statusKey(shipment.status);
  const delaySignals = [
    status.includes('delay'),
    etaDays !== null && etaDays < 0 && status !== 'delivered',
    number(logistics.expectedDelayMinutes) > 30,
    routeDelayMinutes(routeIntel) > 45,
    freshHours > 36 && status !== 'delivered',
  ].filter(Boolean).length;

  return {
    progress,
    etaDays,
    freshHours,
    routeRisk: routeRiskValue,
    routeDelayMinutes: routeDelayMinutes(routeIntel),
    delaySignals,
    deliveryConfidence: clamp(logistics.deliveryConfidence),
    expectedDelayMinutes: clamp(logistics.expectedDelayMinutes, 0, 600),
    priorityBoost: /urgent|express|priority/i.test(`${shipment.priority || ''} ${shipment.shipmentType || ''}`) ? 10 : 0,
    isRepeatedProblemRoute: Boolean(companyStats.problemRoutes?.has(routePair(shipment))),
    status,
  };
}

function routePair(shipment) {
  const origin = locationText(shipment.origin).split(',')[0]?.trim().toLowerCase();
  const destination = locationText(shipment.destination).split(',')[0]?.trim().toLowerCase();
  return [origin, destination].filter(Boolean).join('->');
}

function recommendationScore(base, factors = {}) {
  return clamp(Object.values(factors).reduce((sum, value) => sum + number(value), base));
}

function explainRecommendation(type, factors, routeIntel) {
  const reasons = [];
  if (factors.fraudRisk >= 20) reasons.push('fraud risk score is elevated');
  if (factors.etaLate >= 20) reasons.push('ETA window has already passed');
  if (factors.routeRisk >= 10) reasons.push('weather, traffic, or road risk is affecting the route');
  if (factors.staleScan >= 8) reasons.push('latest scan is stale');
  if (factors.capacity >= 8) reasons.push('recommended warehouse has better available capacity');
  if (factors.history >= 6) reasons.push('similar company history shows repeated operational risk');
  if (factors.userBehavior >= 4) reasons.push('recent admin activity suggests this workflow needs attention');
  if (!reasons.length) reasons.push(`${type.replace(/_/g, ' ')} signal is currently the strongest next action`);

  const riskSummary = routeIntel ? [
    routeIntel.weather?.condition,
    routeIntel.traffic?.condition,
    routeIntel.road?.condition,
  ].filter(Boolean).join(' | ') : '';

  return {
    reasons,
    summary: riskSummary ? `${reasons.join('; ')}. Route context: ${riskSummary}.` : `${reasons.join('; ')}.`,
  };
}

async function companyRecommendationContext(companyId) {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [recentShipments, auditLogs] = await Promise.all([
    Shipment.find({ companyId, createdAt: { $gte: since } })
      .select('status origin destination estimatedDelivery createdAt updatedAt fraud history')
      .sort({ updatedAt: -1 })
      .limit(300)
      .lean()
      .exec(),
    AuditLog.find({ companyId, createdAt: { $gte: since } })
      .select('action resourceType createdAt success')
      .sort({ createdAt: -1 })
      .limit(150)
      .lean()
      .exec(),
  ]);

  const problemRoutes = new Map();
  let delivered = 0;
  let delayed = 0;
  let fraud = 0;

  recentShipments.forEach((shipment) => {
    const status = statusKey(shipment.status);
    const isDelayed = status.includes('delay') || (shipment.estimatedDelivery && new Date(shipment.estimatedDelivery) < new Date(shipment.updatedAt || Date.now()) && status !== 'delivered');
    if (status === 'delivered') delivered += 1;
    if (isDelayed) delayed += 1;
    if (shipment.fraud?.isFlagged) fraud += 1;
    const pair = routePair(shipment);
    if (pair && (isDelayed || shipment.fraud?.isFlagged)) {
      problemRoutes.set(pair, (problemRoutes.get(pair) || 0) + 1);
    }
  });

  const repeatedProblemRoutes = new Set([...problemRoutes.entries()].filter(([, count]) => count >= 2).map(([pair]) => pair));
  const actionCounts = auditLogs.reduce((counts, log) => {
    counts[log.action] = (counts[log.action] || 0) + 1;
    return counts;
  }, {});

  return {
    shipmentCount: recentShipments.length,
    deliveredRate: recentShipments.length ? delivered / recentShipments.length : 0,
    delayRate: recentShipments.length ? delayed / recentShipments.length : 0,
    fraudRate: recentShipments.length ? fraud / recentShipments.length : 0,
    problemRoutes: repeatedProblemRoutes,
    actionCounts,
  };
}

function userBehaviorBoost(type, companyStats) {
  const actions = companyStats.actionCounts || {};
  if (type === 'warehouse') return Math.min(10, number(actions['shipment.assign']) * 2);
  if (type === 'delay') return Math.min(10, number(actions['shipment.status.update']) * 1.5);
  if (type === 'fraud') return Math.min(10, number(actions['notification.read']) + number(actions['shipment.status.update']));
  return 0;
}

function selectBestWarehouse(shipment, warehouses) {
  if (!warehouses.length) return null;
  const destinationText = locationText(shipment.destination).toLowerCase();
  const currentText = locationText(shipment.currentLocation).toLowerCase();

  return warehouses
    .map((warehouse) => {
      const load = warehouseLoad(warehouse);
      const delay = number(warehouse.hubDelayScore);
      const pending = number(warehouse.pendingShipments);
      const city = String(warehouse.city || '').toLowerCase();
      const cityMatch = city && (destinationText.includes(city) || currentText.includes(city));
      const score = clamp(
        100 -
        load * 0.44 -
        delay * 0.26 -
        pending * 0.8 +
        (cityMatch ? 18 : 0) -
        (/high/i.test(warehouse.riskLevel || '') ? 12 : 0)
      );
      return { warehouse, score, load, delay, pending, cityMatch };
    })
    .sort((a, b) => b.score - a.score)[0];
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

async function recommendationFromShipment(shipment, warehouses, companyStats) {
  const fraud = scoreShipmentFraud(shipment);
  const progress = latestProgress(shipment);
  const etaLate = shipment.estimatedDelivery && new Date(shipment.estimatedDelivery) < new Date() && shipment.status !== 'Delivered';
  const routeIntel = await routeRisk(shipment);
  const features = shipmentFeatureVector(shipment, routeIntel, companyStats);
  const routeRiskValue = features.routeRisk;
  const historyBoost = features.isRepeatedProblemRoute ? 10 : 0;

  if (fraud.isFlagged) {
    const factors = {
      fraudRisk: fraud.riskScore * 0.46,
      etaLate: etaLate ? 18 : 0,
      routeRisk: routeRiskValue * 0.16,
      staleScan: features.freshHours > 36 ? 8 : 0,
      history: historyBoost,
      userBehavior: userBehaviorBoost('fraud', companyStats),
    };
    const score = recommendationScore(42, factors);
    const explanation = explainRecommendation('fraud', factors, routeIntel);
    return {
      id: `fraud-${shipment._id}`,
      type: 'fraud',
      trackingNumber: shipment.trackingNumber,
      title: `Verify ${shipment.trackingNumber} before delivery`,
      details: explanation.summary,
      score,
      priority: score >= 85 ? 'Critical' : 'High',
      confidence: clamp(62 + fraud.riskScore * 0.3 + routeRiskValue * 0.08),
      nextAction: 'Open shipment, verify scan history, notify customer if needed, and hold delivery until cleared.',
      factors,
      reasons: fraud.alerts,
      routeIntelligence: routeIntel,
    };
  }

  if (etaLate || features.delaySignals >= 2 || features.routeDelayMinutes >= 60) {
    const factors = {
      etaLate: etaLate ? 30 : 8,
      routeRisk: routeRiskValue * 0.22,
      staleScan: features.freshHours > 36 ? 12 : 0,
      history: historyBoost,
      priority: features.priorityBoost,
      userBehavior: userBehaviorBoost('delay', companyStats),
    };
    const score = recommendationScore(38, factors);
    const explanation = explainRecommendation('delay', factors, routeIntel);
    return {
      id: `delay-${shipment._id}`,
      type: 'delay',
      trackingNumber: shipment.trackingNumber,
      title: `Escalate delayed shipment ${shipment.trackingNumber}`,
      details: explanation.summary,
      score,
      priority: score >= 82 ? 'High' : 'Medium',
      confidence: clamp(58 + features.delaySignals * 10 + routeRiskValue * 0.18),
      nextAction: 'Prioritize the next hub scan, review weather/traffic risk, and send a revised ETA to the customer.',
      factors,
      reasons: explanation.reasons,
      routeIntelligence: routeIntel,
    };
  }

  if (!shipment.warehouseId && warehouses.length) {
    const selected = selectBestWarehouse(shipment, warehouses);
    const warehouse = selected?.warehouse;
    if (!warehouse) return null;
    const factors = {
      capacity: Math.max(0, 28 - selected.load * 0.18),
      routeRisk: routeRiskValue * 0.08,
      history: historyBoost,
      cityMatch: selected.cityMatch ? 10 : 0,
      userBehavior: userBehaviorBoost('warehouse', companyStats),
    };
    const score = recommendationScore(44, factors);
    const explanation = explainRecommendation('warehouse', factors, routeIntel);
    return {
      id: `warehouse-${shipment._id}`,
      type: 'warehouse',
      trackingNumber: shipment.trackingNumber,
      title: `Assign ${shipment.trackingNumber} to ${warehouse.name}`,
      details: `${explanation.summary} Warehouse load ${selected.load}%, hub delay ${selected.delay}, pending ${selected.pending}.`,
      score,
      priority: score >= 78 ? 'High' : 'Medium',
      confidence: clamp(55 + selected.score * 0.35 + (selected.cityMatch ? 8 : 0)),
      nextAction: `Assign to ${warehouse.name}, then update current location and ETA.`,
      factors,
      reasons: explanation.reasons,
      warehouseId: String(warehouse._id),
      warehouse: {
        id: String(warehouse._id),
        name: warehouse.name,
        city: warehouse.city,
        load: selected.load,
        hubDelayScore: selected.delay,
        score: selected.score,
      },
      routeIntelligence: routeIntel,
    };
  }

  if (progress > 70 && shipment.status !== 'Delivered') {
    const factors = {
      progress: (progress - 70) * 0.65,
      routeRisk: routeRiskValue * 0.12,
      staleScan: features.freshHours > 24 ? 8 : 0,
      confidenceGap: Math.max(0, 80 - features.deliveryConfidence) * 0.10,
      priority: features.priorityBoost,
    };
    const score = recommendationScore(48, factors);
    const explanation = explainRecommendation('last_mile', factors, routeIntel);
    return {
      id: `lastmile-${shipment._id}`,
      type: 'last_mile',
      trackingNumber: shipment.trackingNumber,
      title: `Prepare last-mile handoff for ${shipment.trackingNumber}`,
      details: explanation.summary,
      score,
      priority: 'Medium',
      confidence: clamp(58 + progress * 0.28 - routeRiskValue * 0.06),
      nextAction: 'Reserve destination hub capacity, check driver availability, and prepare customer delivery notification.',
      factors,
      reasons: explanation.reasons,
      routeIntelligence: routeIntel,
    };
  }

  return null;
}

async function buildRecommendations(companyId) {
  const [shipments, warehouses, companyStats] = await Promise.all([
    Shipment.find({ companyId, status: { $ne: 'Delivered' } }).sort({ updatedAt: -1 }).limit(80).exec(),
    Warehouse.find({ companyId }).sort({ updatedAt: -1 }).limit(10).exec(),
    companyRecommendationContext(companyId),
  ]);

  const recommendations = (await Promise.all(shipments
    .map((shipment) => recommendationFromShipment(shipment, warehouses, companyStats))))
    .filter(Boolean)
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 12);

  if (!recommendations.length && warehouses.length) {
    recommendations.push(...warehouses
      .map((warehouse) => {
        const load = warehouseLoad(warehouse);
        const score = clamp(76 - load * 0.22 - number(warehouse.hubDelayScore) * 0.18);
        return {
          id: `warehouse-${warehouse._id}`,
          type: 'capacity',
          title: `Use ${warehouse.name} for local fulfillment`,
          details: `Warehouse in ${warehouse.city || warehouse.country || 'your region'} has ${load}% load and can support next-mile distribution.`,
          score,
          priority: score >= 70 ? 'Low' : 'Monitor',
          confidence: clamp(55 + score * 0.35),
          nextAction: 'Create or assign an active shipment to unlock route-specific recommendations.',
          warehouseId: String(warehouse._id),
          factors: { capacity: Math.max(0, 100 - load), hubDelay: number(warehouse.hubDelayScore) },
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3));
  }

  if (!recommendations.length) {
    recommendations.push({
      id: 'setup-warehouses',
      type: 'setup',
      title: 'Add warehouses to unlock routing recommendations',
      details: 'Create at least one warehouse and active shipment. AI will suggest assignments, delay actions, and fraud checks automatically.',
      score: 60,
      priority: 'Setup',
      confidence: 100,
      nextAction: 'Add a warehouse, then create a shipment with origin, destination, ETA, and package details.',
      factors: { setup: 60 },
    });
  }

  return recommendations.map((recommendation, index) => ({
    rank: index + 1,
    model: 'zyraviq-ops-ranker-v2',
    generatedAt: new Date().toISOString(),
    ...recommendation,
  }));
}

module.exports = { scoreShipmentFraud, scanFraudForCompany, buildRecommendations, publishFraudNotifications };
