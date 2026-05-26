const router = require('express').Router();
const { analyzeTracking, chat } = require('../services/aiClient');
const { findShipmentForChat, latestActiveShipment } = require('../services/trackingLookup');

// POST /api/ai/public/chat
router.post('/chat', async (req, res) => {
  const { message, trackingNumber } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'message required' });

  try {
    const match = trackingNumber || String(message).match(/\b[A-Z]{2,}-[A-Z0-9-]+\b|\b\d{4,}\b/i)?.[0] || null;
    const lookupMeta = match ? await findShipmentForChat({ trackingNumber: match }) : null;
    const shipment = lookupMeta?.shipment || null;
    const shipmentData = shipment ? shipment.toObject() : null;
    if (shipmentData) shipmentData.aiInsights = await analyzeTracking({ shipment: shipmentData });
    const suggestedShipment = shipmentData ? null : await latestActiveShipment({});

    const ai = await chat({
      message: String(message),
      trackingNumber: match || shipmentData?.trackingNumber || null,
      role: 'public',
      context: {
        role: 'public',
        trackingNumber: match || shipmentData?.trackingNumber || null,
        shipment: shipmentData,
        recommendations: suggestedShipment ? {
          lookup: {
            requestedTracking: match,
            tried: lookupMeta?.candidates || [],
            suggestedTracking: suggestedShipment.trackingNumber,
          },
        } : null,
      },
    });
    res.json({ reply: ai.reply || 'Sorry, I could not generate a response.', shipment: shipmentData });
  } catch (err) {
    console.error('publicAiRoutes error', err?.response?.data || err.message || err);
    res.status(502).json({ error: 'AI request failed', detail: err?.message || 'unknown error' });
  }
});

module.exports = router;
