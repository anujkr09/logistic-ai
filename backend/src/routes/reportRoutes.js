const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/authMiddleware');
const { Shipment, Warehouse, Driver, Vehicle, AuditLog } = require('../services/models');
const { enrichShipment } = require('../services/logisticsEngine');

router.get('/operations', requireAuth, requireRole(['admin', 'warehouse_manager']), async (req, res) => {
  const [shipmentsRaw, warehouses, drivers, vehicles, auditLogs] = await Promise.all([
    Shipment.find({ companyId: req.user.companyId }).sort({ updatedAt: -1 }).limit(200).exec(),
    Warehouse.find({ companyId: req.user.companyId }).lean().exec(),
    Driver.find({ companyId: req.user.companyId }).lean().exec(),
    Vehicle.find({ companyId: req.user.companyId }).lean().exec(),
    AuditLog.find({ companyId: req.user.companyId }).sort({ createdAt: -1 }).limit(50).lean().exec(),
  ]);

  const shipments = shipmentsRaw.map((shipment) => enrichShipment(shipment));
  const active = shipments.filter((shipment) => !['Delivered', 'Cancelled', 'Returned'].includes(shipment.status));
  const delayed = shipments.filter((shipment) => shipment.status === 'Delayed' || Number(shipment.logistics?.expectedDelayMinutes || 0) > 0);
  const exceptions = shipments.filter((shipment) => ['Exception', 'Returned', 'Cancelled'].includes(shipment.status));
  const avgConfidence = shipments.length
    ? Math.round(shipments.reduce((sum, shipment) => sum + Number(shipment.logistics?.deliveryConfidence || 0), 0) / shipments.length)
    : 0;

  res.json({
    summary: {
      totalShipments: shipments.length,
      activeShipments: active.length,
      delayedShipments: delayed.length,
      exceptionShipments: exceptions.length,
      warehouses: warehouses.length,
      drivers: drivers.length,
      vehicles: vehicles.length,
      aiPredictionConfidence: avgConfidence,
    },
    delayMonitor: delayed.slice(0, 25).map((shipment) => ({
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      currentLocation: shipment.currentLocation,
      expectedDelayMinutes: shipment.logistics?.expectedDelayMinutes || 0,
      weatherImpact: shipment.logistics?.weatherImpact || '',
      confidence: shipment.logistics?.deliveryConfidence || 0,
    })),
    vehicleMonitor: vehicles,
    driverMonitor: drivers,
    auditLogs,
  });
});

router.get('/audit-logs', requireAuth, requireRole(['admin']), async (req, res) => {
  const items = await AuditLog.find({ companyId: req.user.companyId }).sort({ createdAt: -1 }).limit(100).lean().exec();
  res.json({ items, auditLogs: items });
});

module.exports = router;
