const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/authMiddleware');
const { buildRecommendations, scanFraudForCompany } = require('../services/operationsIntelligence');

router.get('/recommendations', requireAuth, requireRole(['admin', 'warehouse_manager']), async (req, res) => {
  await scanFraudForCompany(req.user.companyId);
  const recommendations = await buildRecommendations(req.user.companyId);

  res.json({ recommendations });
});

router.post('/recommendations/refresh', requireAuth, requireRole(['admin', 'warehouse_manager']), async (req, res) => {
  await scanFraudForCompany(req.user.companyId);
  const recommendations = await buildRecommendations(req.user.companyId);
  res.json({ recommendations, refreshed: true });
});

module.exports = router;
