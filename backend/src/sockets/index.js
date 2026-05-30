const { initShipmentSocket } = require('./shipmentSocket');
const { setIo } = require('./instance');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, SOCKET_CORS_ORIGIN } = require('../config/env');

function socketOrigins() {
  return SOCKET_CORS_ORIGIN === '*'
    ? '*'
    : SOCKET_CORS_ORIGIN.split(',').map((origin) => origin.trim());
}

function initSocket(app) {
  const http = require('http');
  const server = http.createServer(app);

  const { Server } = require('socket.io');
  const io = new Server(server, {
    cors: { origin: socketOrigins(), credentials: SOCKET_CORS_ORIGIN !== '*' },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      socket.user = null;
      return next();
    }

    try {
      const payload = jwt.verify(String(token), JWT_SECRET);
      socket.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        companyId: payload.companyId,
      };
      return next();
    } catch (err) {
      return next(new Error('Invalid socket token'));
    }
  });

  setIo(io);
  initShipmentSocket(io);
  const { initChatSocket } = require('./chatSocket');
  initChatSocket(io);


  const PORT = process.env.PORT || 4000;
  server.listen(PORT, () => {
    console.log(`ZYRAVIQ backend socket server on ${PORT}`);
  });
}

module.exports = { initSocket };


