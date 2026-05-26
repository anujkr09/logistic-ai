const { v4: uuidv4 } = require('uuid');
const { analyzeTracking, streamChat } = require('../services/aiClient');
const { findShipmentForChat, latestActiveShipment } = require('../services/trackingLookup');

function getTrackingFromText(message) {
  if (!message) return null;
  const match = String(message).match(/\b[A-Z]{2,}-[A-Z0-9-]+\b|\b\d{4,}\b/i);
  return match?.[0] || null;
}

function initChatSocket(io) {
  io.on('connection', (socket) => {
    socket.on('chat:subscribe', ({ companyId, trackingNumber }) => {
      try {
        if (companyId) {
          if (!socket.user || String(socket.user.companyId) !== String(companyId)) {
            socket.emit('chat:subscribed', { ok: false, message: 'Unauthorized company subscription' });
            return;
          }
          socket.join(`company:${companyId}`);
        }
        if (trackingNumber) socket.join(`tracking:${trackingNumber}`);
        socket.emit('chat:subscribed', { ok: true });
      } catch (e) {
        socket.emit('chat:subscribed', { ok: false, message: e.message });
      }
    });

    socket.on('chat:message', async (data = {}) => {
      const sessionId = data.sessionId || uuidv4();
      const message = String(data.message || '').trim();
      if (!message) {
        socket.emit('chat:error', { sessionId, message: 'message required' });
        return;
      }

      const companyId = socket.user?.companyId || data.companyId || null;
      const role = socket.user?.role || data.role || 'customer';

      const trackingNumber = data.trackingNumber || getTrackingFromText(message);

      // typing start: emit a first empty token for UI responsiveness
      socket.emit('chat:token', { sessionId, delta: '' });

      try {
        // Best-effort grounded data for current shipping context
        let shipment = null;
        let lookupMeta = null;
        if (trackingNumber) {
          lookupMeta = await findShipmentForChat({ trackingNumber, companyId });
          shipment = lookupMeta.shipment;
        }
        const shipmentData = shipment ? shipment.toObject() : null;
        if (shipmentData) {
          shipmentData.aiInsights = await analyzeTracking({ shipment: shipmentData });
        }
        const suggestedShipment = shipmentData ? null : await latestActiveShipment({ companyId });

      const payload = {
        message,
        trackingNumber: trackingNumber || shipmentData?.trackingNumber || null,
        companyId,
        role,
        context: {
          role,
          companyId,
          trackingNumber: trackingNumber || shipmentData?.trackingNumber || null,
          shipment: shipmentData,
          recommendations: suggestedShipment ? {
            lookup: {
              requestedTracking: trackingNumber || null,
              tried: lookupMeta?.candidates || [],
              suggestedTracking: suggestedShipment.trackingNumber,
            },
          } : null,
        },
      };

      for await (const chunk of streamChat(payload)) {
        if (chunk) socket.emit('chat:token', { sessionId, delta: chunk });
      }

      socket.emit('chat:done', { sessionId });

      } catch (e) {
        socket.emit('chat:error', {
          sessionId,
          message: e?.message || 'AI chat failed',
        });
      }
    });
  });
}

module.exports = { initChatSocket };

