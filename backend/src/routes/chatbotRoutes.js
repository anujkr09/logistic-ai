const router = require('express').Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { analyzeTracking, chat } = require('../services/aiClient');
const { findShipmentForChat, latestActiveShipment } = require('../services/trackingLookup');
const { enrichShipment } = require('../services/logisticsEngine');

router.post('/', requireAuth, async (req, res) => {
  const { message, trackingNumber } = req.body || {};
  if (!message) return res.status(400).json({ message: 'message required' });

  let shipment = null;
  let lookupMeta = null;
  if (trackingNumber) {
    lookupMeta = await findShipmentForChat({ trackingNumber, companyId: req.user.companyId });
    shipment = lookupMeta.shipment;
  } else {
    const match = String(message).match(/\b[A-Z]{2,}-[A-Z0-9-]+\b|\b\d{4,}\b/i);
    if (match) {
      lookupMeta = await findShipmentForChat({ trackingNumber: match[0], companyId: req.user.companyId });
      shipment = lookupMeta.shipment;
    }
  }

  const suggestedShipment = shipment ? null : await latestActiveShipment({ companyId: req.user.companyId });

  const shipmentData = shipment ? enrichShipment(shipment) : null;
  if (shipmentData) {
    shipmentData.aiInsights = await analyzeTracking({ shipment: shipmentData });
  }

  const ai = await chat({
    message: String(message),
    trackingNumber: trackingNumber || shipmentData?.trackingNumber || null,
    companyId: req.user.companyId,
    role: req.user.role || 'customer',
    context: {
      role: req.user.role || 'customer',
      companyId: req.user.companyId,
      trackingNumber: trackingNumber || shipmentData?.trackingNumber || null,
      shipment: shipmentData,
      recommendations: suggestedShipment ? {
        lookup: {
          requestedTracking: trackingNumber || lookupMeta?.candidates?.[0] || null,
          tried: lookupMeta?.candidates || [],
          suggestedTracking: suggestedShipment.trackingNumber,
        },
      } : null,
    },
  });

  let reply = ai.reply;

  // Provide grounded context (best-effort) to UI
  res.json({
    reply,
    shipment: shipmentData,
  });
});

module.exports = router;


