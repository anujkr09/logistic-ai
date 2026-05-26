const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { Shipment } = require('../services/models');
const { scanFraudForCompany, scoreShipmentFraud, publishFraudNotifications } = require('../services/operationsIntelligence');
const { getIo } = require('../sockets/instance');

router.get('/alerts', requireAuth, requireRole(['admin']), async (req, res) => {
  await scanFraudForCompany(req.user.companyId);

  const alerts = await Shipment.find({
    companyId: req.user.companyId,
    'fraud.isFlagged': true,
  })
    .sort({ updatedAt: -1 })
    .limit(100)
    .exec();

  const normalized = alerts.map((shipment) => ({
    trackingNumber: shipment.trackingNumber,
    title: `Fraud risk for ${shipment.trackingNumber}`,
    reason: shipment.fraud?.alerts?.join('; ') || 'Suspicious activity detected',
    riskScore: shipment.fraud?.riskScore || 0,
    status: shipment.status,
    updatedAt: shipment.updatedAt,
  }));

  res.json({ alerts: normalized, items: normalized });
});

router.post('/scan', requireAuth, requireRole(['admin']), async (req, res) => {
  const result = await scanFraudForCompany(req.user.companyId);
  const alerts = result.flagged.map((shipment) => ({
    trackingNumber: shipment.trackingNumber,
    title: `Fraud risk for ${shipment.trackingNumber}`,
    reason: shipment.fraud?.alerts?.join('; ') || scoreShipmentFraud(shipment).alerts.join('; '),
    riskScore: shipment.fraud?.riskScore || scoreShipmentFraud(shipment).riskScore,
    status: shipment.status,
    updatedAt: shipment.updatedAt,
  }));

  res.json({ scanned: result.scanned, flagged: alerts.length, alerts, items: alerts });
});

router.post('/report', requireAuth, async (req, res) => {
  const { trackingNumber, description, suspectedParty } = req.body || {};
  if (!trackingNumber || !description) {
    return res.status(400).json({ message: 'trackingNumber and description required' });
  }

  const shipment = await Shipment.findOne({
    companyId: req.user.companyId,
    trackingNumber: String(trackingNumber).trim().toUpperCase(),
  }).exec();
  if (!shipment) return res.status(404).json({ message: 'Shipment not found' });

  if (!shipment.customerId && req.user.role === 'customer') shipment.customerId = req.user.id;

  const party = String(suspectedParty || 'unknown').trim();
  const reportReason = `Fraud reported by ${req.user.role}: ${String(description).trim()}${party ? ` (suspected party: ${party})` : ''}`;
  const existingAlerts = Array.isArray(shipment.fraud?.alerts) ? shipment.fraud.alerts : [];
  const alerts = [...new Set([reportReason, ...existingAlerts])];
  const baseScore = scoreShipmentFraud(shipment).riskScore;

  shipment.fraud = {
    isFlagged: true,
    riskScore: Math.max(75, baseScore),
    alerts,
  };

  shipment.history.push({
    status: 'Fraud Review',
    location: {
      text: shipment.currentLocation?.text || '',
      city: shipment.currentLocation?.city || '',
      country: shipment.currentLocation?.country || '',
      coordinates: shipment.currentLocation?.coordinates,
    },
    meta: {
      fraudReportedAt: new Date().toISOString(),
      reportedBy: req.user.id,
      suspectedParty: party,
    },
  });

  await shipment.save();
  const notificationResult = await publishFraudNotifications(shipment, shipment.fraud, {
    adminTitle: `Fraud report: ${shipment.trackingNumber}`,
    customerTitle: `Fraud report received for ${shipment.trackingNumber}`,
  });

  try {
    const io = getIo();
    io.to(`company:${req.user.companyId}`).emit('shipment:update', { shipment });
    io.to(`tracking:${shipment.trackingNumber}`).emit('shipment:update', { shipment });
  } catch (error) {
    // Socket may not be initialized in scripts/tests.
  }

  res.status(201).json({
    message: 'Fraud report submitted',
    shipment,
    notifications: notificationResult,
  });
});

module.exports = router;


