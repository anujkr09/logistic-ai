(function(){
  const base = window.__getApiBase?.() || window.API_BASE_URL || 'http://localhost:4000';
  const socketUrl = base.replace(/\/$/, '');
  let socket = null;

  function createSocket(){
    if (window.io && !socket) {
      socket = window.io(socketUrl, {
        auth: { token: localStorage.getItem('token') || '' },
        transports: ['websocket', 'polling'],
      });
    }
    return socket;
  }

  window.__TRACKING_SUBSCRIBE = function(trackingNumber, onUpdate){
    if (!trackingNumber || typeof onUpdate !== 'function') return;
    const ioClient = createSocket();
    if (!ioClient) return;

    ioClient.emit('shipment:subscribe', { trackingNumber });
    ioClient.on('shipment:update', onUpdate);
  };

  window.__COMPANY_SUBSCRIBE = function(companyId, onUpdate){
    if (!companyId || typeof onUpdate !== 'function') return;
    const ioClient = createSocket();
    if (!ioClient) return;

    ioClient.emit('shipment:subscribe', { companyId });
    ioClient.on('shipment:update', onUpdate);
  };
})();

