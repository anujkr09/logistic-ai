const router = require('express').Router();
const mongoose = require('mongoose');
const { WorkspaceItem } = require('../services/models');
const { verifyToken } = require('../utils/jwt');

const allowedEntities = new Set([
  'users',
  'orders',
  'products',
  'shipments',
  'routes',
  'pickups',
  'stores',
  'warehouses',
  'payments',
  'support',
  'packaging',
  'freight',
  'notifications',
]);

function entityName(req) {
  return String(req.params.entity || '').trim().toLowerCase();
}

function sessionKey(req) {
  return String(req.get('x-workspace-session') || req.query.sessionKey || 'public-demo').slice(0, 120);
}

function authContext(req) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return { companyId: null, sessionKey: sessionKey(req) };

  try {
    const payload = verifyToken(token);
    const companyId = payload.companyId && mongoose.Types.ObjectId.isValid(payload.companyId)
      ? payload.companyId
      : null;
    return { companyId, sessionKey: companyId ? null : sessionKey(req) };
  } catch {
    return { companyId: null, sessionKey: sessionKey(req) };
  }
}

function scopeQuery(req) {
  const context = authContext(req);
  if (context.companyId) return { companyId: context.companyId };
  return { companyId: null, sessionKey: context.sessionKey || 'public-demo' };
}

function cleanData(value) {
  const data = value && typeof value === 'object' ? { ...value } : {};
  data.id = String(data.id || `${Date.now()}`);
  return data;
}

router.get('/:entity', async (req, res) => {
  const entity = entityName(req);
  if (!allowedEntities.has(entity)) return res.status(404).json({ message: 'Workspace entity not found' });

  const items = await WorkspaceItem.find({ entity, ...scopeQuery(req) }).sort({ updatedAt: -1 }).lean();
  res.json({
    entity,
    items: items.map((item) => ({ ...item.data, _mongoId: item._id, updatedAt: item.updatedAt, createdAt: item.createdAt })),
  });
});

router.post('/:entity', async (req, res) => {
  const entity = entityName(req);
  if (!allowedEntities.has(entity)) return res.status(404).json({ message: 'Workspace entity not found' });

  const data = cleanData(req.body?.data || req.body || {});
  const scope = scopeQuery(req);
  const item = await WorkspaceItem.findOneAndUpdate(
    { entity, ...scope, 'data.id': data.id },
    { $set: { data } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  res.status(201).json({ item: { ...item.data, _mongoId: item._id, updatedAt: item.updatedAt, createdAt: item.createdAt } });
});

router.put('/:entity/:id', async (req, res) => {
  const entity = entityName(req);
  if (!allowedEntities.has(entity)) return res.status(404).json({ message: 'Workspace entity not found' });

  const data = cleanData({ ...(req.body?.data || req.body || {}), id: req.params.id });
  const item = await WorkspaceItem.findOneAndUpdate(
    { entity, ...scopeQuery(req), 'data.id': String(req.params.id) },
    { $set: { data } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  res.json({ item: { ...item.data, _mongoId: item._id, updatedAt: item.updatedAt, createdAt: item.createdAt } });
});

router.delete('/:entity/:id', async (req, res) => {
  const entity = entityName(req);
  if (!allowedEntities.has(entity)) return res.status(404).json({ message: 'Workspace entity not found' });

  await WorkspaceItem.deleteOne({ entity, ...scopeQuery(req), 'data.id': String(req.params.id) });
  res.json({ ok: true });
});

module.exports = router;
