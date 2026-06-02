const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { Vehicle, Shipment } = require('../services/models');
const { auditAction } = require('../middleware/securityMiddleware');

function vehiclePayload(body = {}) {
  return {
    vehicleNumber: String(body.vehicleNumber || body.number || '').trim().toUpperCase(),
    driverName: String(body.driverName || body.driver || '').trim(),
    vehicleType: String(body.vehicleType || body.type || 'Truck').trim(),
    currentLocation: {
      text: body.currentLocation?.text || body.currentLocation || '',
      coordinates: body.currentLocation?.coordinates || undefined,
    },
    fuelStatus: String(body.fuelStatus || 'Operational').trim(),
    speedKmph: Number(body.speedKmph || body.speed || 0),
    route: String(body.route || '').trim(),
    eta: body.eta ? new Date(body.eta) : null,
    lastGpsUpdate: body.lastGpsUpdate ? new Date(body.lastGpsUpdate) : new Date(),
    status: body.status || 'Available',
  };
}

router.get('/', requireAuth, requireRole(['admin', 'warehouse_manager']), async (req, res) => {
  const vehicles = await Vehicle.find({ companyId: req.user.companyId }).sort({ updatedAt: -1 }).lean().exec();
  const shipments = await Shipment.find({ companyId: req.user.companyId }).select('trackingNumber vehicle status estimatedDelivery').lean().exec();
  const items = vehicles.map((vehicle) => ({
    ...vehicle,
    assignedShipments: shipments
      .filter((shipment) => shipment.vehicle?.number && shipment.vehicle.number.toUpperCase() === vehicle.vehicleNumber.toUpperCase())
      .map((shipment) => shipment.trackingNumber),
  }));

  res.json({ items, vehicles: items });
});

router.post('/', requireAuth, requireRole(['admin', 'warehouse_manager']), auditAction('vehicle.create', 'vehicle'), async (req, res) => {
  const payload = vehiclePayload(req.body || {});
  if (!payload.vehicleNumber) return res.status(400).json({ message: 'Vehicle number required' });

  const vehicle = await Vehicle.findOneAndUpdate(
    { companyId: req.user.companyId, vehicleNumber: payload.vehicleNumber },
    { $set: { companyId: req.user.companyId, ...payload } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();

  res.status(201).json({ vehicle });
});

router.patch('/:id', requireAuth, requireRole(['admin', 'warehouse_manager']), auditAction('vehicle.update', 'vehicle'), async (req, res) => {
  const vehicle = await Vehicle.findOne({ _id: req.params.id, companyId: req.user.companyId }).exec();
  if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

  Object.assign(vehicle, vehiclePayload({ ...vehicle.toObject(), ...(req.body || {}) }));
  await vehicle.save();
  res.json({ vehicle });
});

module.exports = router;
