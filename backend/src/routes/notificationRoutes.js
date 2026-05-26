const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { Notification } = require('../services/models');

router.get('/', requireAuth, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const p = Number(page);
  const l = Number(limit);

  const q = { companyId: req.user.companyId };
  if (req.user.role === 'customer') {
    q.$and = [
      { $or: [{ userId: req.user.id }, { userId: null }] },
      { 'meta.audience': { $ne: 'admin' } },
    ];
  } else {
    q.$or = [{ userId: req.user.id }, { userId: null }, { 'meta.audience': 'admin' }];
  }

  const [items, total] = await Promise.all([
    Notification.find(q)
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .exec(),
    Notification.countDocuments(q),
  ]);

  res.json({ items, notifications: items, page: p, limit: l, total });
});

module.exports = router;


