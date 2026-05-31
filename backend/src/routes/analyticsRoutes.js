const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { Shipment } = require('../services/models');
const { getRevenueSummary } = require('../services/analyticsSummary');

router.get('/customer', requireAuth, async (req, res) => {
  const companyId = req.user.companyId;

  const [items, total, delivered, inTransit, delayed] = await Promise.all([
    Shipment.find({ companyId }).sort({ createdAt: -1 }).limit(100).exec(),
    Shipment.countDocuments({ companyId }),
    Shipment.countDocuments({ companyId, status: 'Delivered' }),
    Shipment.countDocuments({ companyId, status: { $ne: 'Delivered' } }),
    Shipment.countDocuments({ companyId, estimatedDelivery: { $lt: new Date() }, status: { $ne: 'Delivered' } }),
  ]);

  const onTimeRate = total === 0 ? 0 : Math.round(((delivered / total) * 100) * 10) / 10;
  const etaDays = items
    .filter((s) => s.estimatedDelivery)
    .map((s) => {
      const created = new Date(s.createdAt);
      const eta = new Date(s.estimatedDelivery);
      return Math.max(0, (eta - created) / (1000 * 60 * 60 * 24));
    });
  const avgEta = etaDays.length === 0 ? 0 : Math.round((etaDays.reduce((a, b) => a + b, 0) / etaDays.length) * 10) / 10;
  const fraudRisk = items.length === 0 ? 0 : Math.round((items.filter((s) => s.fraud?.isFlagged).length / items.length) * 100 * 10) / 10;

  res.json({
    total,
    delivered,
    inTransit,
    delayed,
    onTimeRate,
    avgEta,
    fraudRisk,
  });
});

router.get('/admin/summary', requireAuth, requireRole(['admin']), async (req, res) => {
  const companyId = req.user.companyId;

  const [total, delivered, delayed, revenueSummary] = await Promise.all([
    Shipment.countDocuments({ companyId }),
    Shipment.countDocuments({ companyId, status: 'Delivered' }),
    Shipment.countDocuments({ companyId, estimatedDelivery: { $lt: new Date() }, status: { $ne: 'Delivered' } }),
    getRevenueSummary(companyId),
  ]);

  res.json({
    totalShipments: total,
    deliveredShipments: delivered,
    delayedShipments: delayed,
    revenue: revenueSummary.revenue,
    revenueComputedAt: revenueSummary.computedAt,
    total,
    delivered,
    delayed,
  });
});

module.exports = router;


