const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { Warehouse, Shipment } = require('../services/models');

router.get('/', requireAuth, async (req, res) => {
  const items = await Warehouse.find({ companyId: req.user.companyId }).sort({ createdAt: -1 }).exec();
  res.json({ items, warehouses: items });
});

router.post('/', requireAuth, requireRole(['admin']), async (req, res) => {
  const { name, address, city, country, coordinates } = req.body || {};
  if (!name) return res.status(400).json({ message: 'name required' });

  const warehouse = await Warehouse.create({
    companyId: req.user.companyId,
    name: String(name).trim(),
    address: address || '',
    city: city || '',
    country: country || '',
    location: {
      type: 'Point',
      coordinates: Array.isArray(coordinates) && coordinates.length === 2 ? coordinates : [0, 0],
    },
    inventory: {},
  });

  res.status(201).json({ warehouse });
});

// Basic inventory status summary
router.get('/summary', requireAuth, async (req, res) => {
  const warehouses = await Warehouse.find({ companyId: req.user.companyId }).exec();

  const totalShipments = await Shipment.countDocuments({ companyId: req.user.companyId });
  const inTransit = await Shipment.countDocuments({ companyId: req.user.companyId, status: { $ne: 'Delivered' } });

  res.json({
    warehouses: warehouses.map((w) => ({
      id: String(w._id),
      name: w.name,
      inventory: w.inventory,
    })),
    totalShipments,
    inTransit,
  });
});

module.exports = router;


