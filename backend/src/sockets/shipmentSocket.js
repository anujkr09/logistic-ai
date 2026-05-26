function initShipmentSocket(io) {
  io.on('connection', (socket) => {
    if (socket.user?.companyId) socket.join(`company:${socket.user.companyId}`);
    if (socket.user?.id) socket.join(`user:${socket.user.id}`);

    // Rooms: company:{companyId}, tracking:{trackingNumber}
    socket.on('shipment:subscribe', ({ companyId, trackingNumber }) => {
      try {
        if (companyId) {
          if (!socket.user || String(socket.user.companyId) !== String(companyId)) {
            socket.emit('shipment:subscribed', { ok: false, message: 'Unauthorized company subscription' });
            return;
          }
          socket.join(`company:${companyId}`);
        }
        if (trackingNumber) socket.join(`tracking:${trackingNumber}`);
        socket.emit('shipment:subscribed', { ok: true });
      } catch (e) {
        socket.emit('shipment:subscribed', { ok: false, message: e.message });
      }
    });

    socket.on('disconnect', () => {
      // no-op
    });
  });
}

module.exports = { initShipmentSocket };

