const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { Notification } = require('../services/models');
const { createAndDispatchNotification } = require('../services/notificationDispatcher');
const { auditAction } = require('../middleware/securityMiddleware');

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

router.post('/test', requireAuth, requireRole(['admin']), auditAction('notification.test', 'notification'), async (req, res) => {
  const channels = Array.isArray(req.body?.channels) && req.body.channels.length ? req.body.channels : ['email', 'sms', 'push'];
  const notification = await createAndDispatchNotification({
    companyId: req.user.companyId,
    userId: req.user.id,
    type: 'system',
    title: 'Notification channel test',
    message: 'ZYRAVIQ notification provider test completed.',
    meta: { audience: 'admin', event: 'notification_test' },
    channels,
  });
  res.status(201).json({ notification });
});

router.patch('/:id/read', requireAuth, auditAction('notification.read', 'notification'), async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, companyId: req.user.companyId }).exec();
  if (!notification) return res.status(404).json({ message: 'Notification not found' });
  notification.readAt = new Date();
  await notification.save();
  res.json({ notification });
});

module.exports = router;


