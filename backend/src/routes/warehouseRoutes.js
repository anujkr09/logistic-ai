const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { Warehouse, Shipment } = require('../services/models');

function riskLevel(score, occupancy, capacity) {
  const occupancyRate = capacity > 0 ? occupancy / capacity : 0;
  if (score >= 70 || occupancyRate >= 0.9) return 'High';
  if (score >= 35 || occupancyRate >= 0.72) return 'Medium';
  return 'Low';
}

async function enrichWarehouses(companyId, warehouses) {
  const shipments = await Shipment.find({ companyId }).select('warehouseId status').lean().exec();
  return warehouses.map((warehouse) => {
    const item = typeof warehouse.toObject === 'function' ? warehouse.toObject() : warehouse;
    const assigned = shipments.filter((shipment) => String(shipment.warehouseId || '') === String(item._id));
    const pending = assigned.filter((shipment) => !['Delivered', 'Cancelled', 'Returned'].includes(shipment.status)).length;
    const incoming = assigned.filter((shipment) => ['Picked Up', 'Departed Origin Hub', 'In Transit'].includes(shipment.status)).length;
    const outgoing = assigned.filter((shipment) => ['At Destination Hub', 'Out For Delivery'].includes(shipment.status)).length;
    const capacity = Number(item.capacity || item.inventory?.total || 0);
    const occupancy = Number(item.occupancy || item.inventory?.used || assigned.length);
    const hubDelayScore = Math.min(100, Number(item.hubDelayScore || 0) + Math.round((capacity ? occupancy / Math.max(capacity, 1) : 0.35) * 40) + pending * 2);

    return {
      ...item,
      capacity,
      occupancy,
      incomingShipments: incoming,
      outgoingShipments: outgoing,
      pendingShipments: pending,
      hubDelayScore,
      riskLevel: item.riskLevel && item.riskLevel !== 'Low' ? item.riskLevel : riskLevel(hubDelayScore, occupancy, capacity),
    };
  });
}

router.get('/', requireAuth, async (req, res) => {
  const warehouses = await Warehouse.find({ companyId: req.user.companyId }).sort({ createdAt: -1 }).exec();
  const items = await enrichWarehouses(req.user.companyId, warehouses);
  res.json({ items, warehouses: items });
});

router.post('/', requireAuth, requireRole(['admin']), async (req, res) => {
  const { name, address, city, country, coordinates, capacity, occupancy, hubDelayScore, riskLevel: requestedRiskLevel } = req.body || {};
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
    capacity: Number(capacity || 0),
    occupancy: Number(occupancy || 0),
    hubDelayScore: Number(hubDelayScore || 0),
    riskLevel: requestedRiskLevel || 'Low',
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


