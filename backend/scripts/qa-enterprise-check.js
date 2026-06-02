const assert = require('assert');

const { normalizeStatus, enrichShipment, computeLogistics } = require('../src/services/logisticsEngine');
const { routeRisk } = require('../src/services/routeIntelligence');
const { buildPdf } = require('../src/services/pdfDocument');

async function run() {
  assert.strictEqual(normalizeStatus('create'), 'Shipment Created');
  assert.strictEqual(normalizeStatus('Out for Delivery'), 'Out For Delivery');

  const shipment = {
    trackingNumber: 'ZQ-QA-1001',
    status: 'Delayed',
    origin: { text: 'Delhi', coordinates: [77.1025, 28.7041] },
    destination: { text: 'Patna', coordinates: [85.1376, 25.5941] },
    currentLocation: { text: 'Kanpur Hub', coordinates: [80.3319, 26.4499] },
    sender: { name: 'Sender', phone: '+919876543210', email: 'sender@example.com', address: 'Delhi' },
    receiver: { name: 'Receiver', phone: '+919123456789', email: 'receiver@example.com', address: 'Patna' },
    driver: { name: 'Driver One', phone: '+919999999999' },
    vehicle: { number: 'DL01AB1234', type: 'Truck' },
    history: [{ status: 'create', location: { text: 'Delhi' }, meta: { autoProgress: 6 } }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const logistics = computeLogistics(shipment);
  assert(logistics.totalDistanceKm > 0, 'distance should be calculated');
  assert(logistics.remainingDistanceKm >= 0, 'remaining distance should be non-negative');
  assert(logistics.deliveryConfidence > 0, 'confidence should be calculated');

  const enriched = enrichShipment(shipment);
  assert(enriched.customerView.senderPhone.includes('XXX'), 'sender phone should be masked');
  assert(enriched.documents.length >= 6, 'documents should be available');
  assert(enriched.routeHistory.length >= 1, 'route history should be available');

  const risk = await routeRisk(shipment);
  assert(risk.weather && risk.traffic && risk.road, 'route intelligence should include weather, traffic and road data');

  const pdf = buildPdf('QA Tracking Report', ['Tracking Number: ZQ-QA-1001', 'Status: Delayed']);
  assert(pdf.subarray(0, 8).toString().startsWith('%PDF-1.'), 'document should be a PDF buffer');

  require('../src/routes/driverRoutes');
  require('../src/routes/vehicleRoutes');
  require('../src/routes/reportRoutes');
  require('../src/middleware/securityMiddleware');

  console.log('Enterprise QA checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
