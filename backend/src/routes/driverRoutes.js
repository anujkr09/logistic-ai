const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { Driver, Shipment } = require('../services/models');
const { auditAction } = require('../middleware/securityMiddleware');

function driverPayload(body = {}) {
  return {
    name: String(body.name || body.driverName || '').trim(),
    phone: String(body.phone || body.driverPhone || '').trim(),
    vehicleNumber: String(body.vehicleNumber || '').trim().toUpperCase(),
    vehicleType: String(body.vehicleType || '').trim(),
    licenseNumber: String(body.licenseNumber || '').trim().toUpperCase(),
    currentStatus: body.currentStatus || body.status || 'Available',
    currentGps: {
      text: body.currentGps?.text || body.currentLocation || '',
      coordinates: body.currentGps?.coordinates || undefined,
      lastPingAt: body.currentGps?.lastPingAt ? new Date(body.currentGps.lastPingAt) : new Date(),
    },
    availability: body.availability !== false,
  };
}

router.get('/', requireAuth, requireRole(['admin', 'warehouse_manager']), async (req, res) => {
  const drivers = await Driver.find({ companyId: req.user.companyId }).sort({ updatedAt: -1 }).lean().exec();
  const shipments = await Shipment.find({ companyId: req.user.companyId }).select('trackingNumber driver status').lean().exec();

  const items = drivers.map((driver) => ({
    ...driver,
    assignedShipments: shipments
      .filter((shipment) => shipment.driver?.name && shipment.driver.name.toLowerCase() === driver.name.toLowerCase())
      .map((shipment) => shipment.trackingNumber),
  }));

  res.json({ items, drivers: items });
});

router.post('/', requireAuth, requireRole(['admin', 'warehouse_manager']), auditAction('driver.create', 'driver'), async (req, res) => {
  const payload = driverPayload(req.body || {});
  if (!payload.name) return res.status(400).json({ message: 'Driver name required' });

  const driver = await Driver.create({
    companyId: req.user.companyId,
    ...payload,
  });

  res.status(201).json({ driver });
});

router.patch('/:id', requireAuth, requireRole(['admin', 'warehouse_manager']), auditAction('driver.update', 'driver'), async (req, res) => {
  const driver = await Driver.findOne({ _id: req.params.id, companyId: req.user.companyId }).exec();
  if (!driver) return res.status(404).json({ message: 'Driver not found' });

  Object.assign(driver, driverPayload({ ...driver.toObject(), ...(req.body || {}) }));
  await driver.save();
  res.json({ driver });
});

module.exports = router;
