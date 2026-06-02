const PROFESSIONAL_STATUSES = [
  'Shipment Created',
  'Pickup Scheduled',
  'Picked Up',
  'At Origin Hub',
  'Departed Origin Hub',
  'In Transit',
  'At Destination Hub',
  'Out For Delivery',
  'Delivered',
  'Delayed',
  'Exception',
  'Returned',
  'Cancelled',
];

const STATUS_ALIASES = new Map([
  ['create', 'Shipment Created'],
  ['created', 'Shipment Created'],
  ['shipment created', 'Shipment Created'],
  ['pickup scheduled', 'Pickup Scheduled'],
  ['picked up', 'Picked Up'],
  ['at origin hub', 'At Origin Hub'],
  ['departed origin hub', 'Departed Origin Hub'],
  ['in transit', 'In Transit'],
  ['arrived', 'At Destination Hub'],
  ['at destination hub', 'At Destination Hub'],
  ['out for delivery', 'Out For Delivery'],
  ['out for delivery', 'Out For Delivery'],
  ['delivered', 'Delivered'],
  ['delayed', 'Delayed'],
  ['exception', 'Exception'],
  ['returned', 'Returned'],
  ['cancelled', 'Cancelled'],
  ['canceled', 'Cancelled'],
]);

const CITY_COORDINATES = [
  ['delhi', [77.1025, 28.7041]],
  ['new delhi', [77.209, 28.6139]],
  ['kanpur', [80.3319, 26.4499]],
  ['prayagraj', [81.8463, 25.4358]],
  ['allahabad', [81.8463, 25.4358]],
  ['patna', [85.1376, 25.5941]],
  ['mumbai', [72.8777, 19.076]],
  ['pune', [73.8567, 18.5204]],
  ['bengaluru', [77.5946, 12.9716]],
  ['bangalore', [77.5946, 12.9716]],
  ['hyderabad', [78.4867, 17.385]],
  ['chennai', [80.2707, 13.0827]],
  ['kolkata', [88.3639, 22.5726]],
  ['lucknow', [80.9462, 26.8467]],
  ['jaipur', [75.7873, 26.9124]],
  ['ahmedabad', [72.5714, 23.0225]],
  ['surat', [72.8311, 21.1702]],
  ['indore', [75.8577, 22.7196]],
  ['kochi', [76.2673, 9.9312]],
  ['goa', [74.124, 15.2993]],
  ['dubai', [55.2708, 25.2048]],
  ['singapore', [103.8198, 1.3521]],
  ['london', [-0.1276, 51.5072]],
  ['new york', [-74.006, 40.7128]],
];

function normalizeStatus(status) {
  const raw = String(status || '').trim();
  if (!raw) return 'Shipment Created';
  const key = raw.toLowerCase();
  return STATUS_ALIASES.get(key) || PROFESSIONAL_STATUSES.find((item) => item.toLowerCase() === key) || raw;
}

function statusProgress(status) {
  const normalized = normalizeStatus(status);
  const map = {
    'Shipment Created': 6,
    'Pickup Scheduled': 12,
    'Picked Up': 22,
    'At Origin Hub': 32,
    'Departed Origin Hub': 42,
    'In Transit': 58,
    'At Destination Hub': 76,
    'Out For Delivery': 90,
    Delivered: 100,
    Delayed: 54,
    Exception: 45,
    Returned: 38,
    Cancelled: 0,
  };
  return map[normalized] ?? 10;
}

function locationText(location, fallback = '') {
  if (!location) return fallback;
  if (typeof location === 'string') return location || fallback;
  return location.text || [location.city, location.country].filter(Boolean).join(', ') || fallback;
}

function hashText(value) {
  return String(value || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function coordinatesFor(location) {
  const coordinates = location?.coordinates;
  if (Array.isArray(coordinates) && coordinates.length >= 2) {
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }

  const text = locationText(location, '').toLowerCase();
  const match = CITY_COORDINATES.find(([city]) => text.includes(city));
  if (match) return match[1];
  const seed = hashText(text || 'india');
  return [68 + ((seed * 7) % 2800) / 100, 8 + (seed % 2600) / 100];
}

function haversineKm(a, b) {
  if (!a || !b) return 0;
  const toRad = (value) => (Number(value) * Math.PI) / 180;
  const [lng1, lat1] = a;
  const [lng2, lat2] = b;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sLat1 = toRad(lat1);
  const sLat2 = toRad(lat2);
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(sLat1) * Math.cos(sLat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function realisticDistanceKm(origin, destination) {
  const airKm = haversineKm(coordinatesFor(origin), coordinatesFor(destination));
  if (!airKm) return 0;
  return Math.round(airKm * 1.28);
}

function currentProgress(shipment) {
  const history = Array.isArray(shipment?.history) ? shipment.history : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const progress = Number(history[index]?.meta?.autoProgress ?? history[index]?.progressPercent);
    if (Number.isFinite(progress)) return Math.max(0, Math.min(100, progress));
  }
  return statusProgress(shipment?.status);
}

function weatherFor(shipment) {
  const current = locationText(shipment?.currentLocation, locationText(shipment?.destination, 'route'));
  const conditions = [
    { label: 'Clear', detail: 'No weather-related delays expected.', riskScore: 4, expectedDelayMinutes: 0 },
    { label: 'Cloudy', detail: 'Cloud cover on route; normal movement expected.', riskScore: 10, expectedDelayMinutes: 0 },
    { label: 'Rain', detail: `Rain alerts near ${current}. Expected delay: 35 minutes.`, riskScore: 34, expectedDelayMinutes: 35 },
    { label: 'Storm Watch', detail: `Storm watch near ${current}. Expected delay: 1 hour 20 minutes.`, riskScore: 62, expectedDelayMinutes: 80 },
  ];
  const item = conditions[hashText(current) % conditions.length];
  return { ...item, location: current, temperatureC: 24 + (hashText(current) % 10) };
}

function averageSpeedFor(shipment, weather) {
  const priority = String(shipment?.priority || '').toLowerCase();
  const type = String(shipment?.shipmentType || '').toLowerCase();
  let speed = priority.includes('express') || type.includes('express') ? 68 : 56;
  if (weather.riskScore > 40) speed -= 12;
  if (normalizeStatus(shipment?.status) === 'Out For Delivery') speed = 28;
  if (normalizeStatus(shipment?.status) === 'Delivered') speed = 0;
  return Math.max(18, speed);
}

function computeLogistics(shipment) {
  const status = normalizeStatus(shipment?.status);
  const progress = currentProgress({ ...shipment, status });
  const totalDistanceKm = Number(shipment?.logistics?.totalDistanceKm) || realisticDistanceKm(shipment?.origin, shipment?.destination);
  const coveredDistanceKm = Math.round(Number(shipment?.logistics?.coveredDistanceKm) || (totalDistanceKm * progress) / 100);
  const remainingDistanceKm = Math.max(0, totalDistanceKm - coveredDistanceKm);
  const weather = weatherFor(shipment);
  const averageSpeedKmph = Number(shipment?.logistics?.averageSpeedKmph) || averageSpeedFor(shipment, weather);
  const delayMinutes = status === 'Delayed' ? Math.max(90, weather.expectedDelayMinutes) : weather.expectedDelayMinutes;
  const travelHours = averageSpeedKmph > 0 ? remainingDistanceKm / averageSpeedKmph : 0;
  const handlingHours = status === 'Shipment Created' || status === 'Pickup Scheduled' ? 8 : status === 'Out For Delivery' ? 2 : 5;
  const eta = status === 'Delivered' ? shipment?.updatedAt || shipment?.estimatedDelivery : new Date(Date.now() + (travelHours + handlingHours) * 60 * 60 * 1000 + delayMinutes * 60 * 1000);
  const baseConfidence = progress >= 85 ? 94 : progress >= 55 ? 88 : progress >= 25 ? 82 : 74;
  const confidence = Math.max(45, Math.min(98, baseConfidence - Math.round(weather.riskScore / 6) - (status === 'Delayed' ? 10 : 0)));

  return {
    status,
    currentStage: status,
    progressPercent: Math.round(progress),
    totalDistanceKm,
    coveredDistanceKm,
    remainingDistanceKm,
    averageSpeedKmph,
    estimatedDelivery: eta ? new Date(eta).toISOString() : null,
    deliveryConfidence: confidence,
    expectedDelayMinutes: delayMinutes,
    weatherImpact: weather.detail,
    weatherRiskScore: weather.riskScore,
    weather,
    lastGpsPingAt: shipment?.logistics?.lastGpsPingAt || shipment?.updatedAt || shipment?.createdAt || new Date().toISOString(),
  };
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  const last = digits.slice(-3);
  const prefix = String(value || '').trim().startsWith('+') ? String(value || '').trim().slice(0, 3) : '+91';
  return `${prefix} XXXXXXX${last}`;
}

function maskEmail(value) {
  const email = String(value || '');
  const [name, domain] = email.split('@');
  if (!name || !domain) return '';
  return `${name.slice(0, 2)}***@${domain}`;
}

function safeCustomerView(shipment) {
  return {
    senderName: shipment?.sender?.name || '',
    receiverName: shipment?.receiver?.name || '',
    pickupAddress: shipment?.sender?.address || shipment?.origin?.text || '',
    deliveryAddress: shipment?.receiver?.address || shipment?.destination?.text || '',
    pickupContact: shipment?.sender?.contactName || shipment?.sender?.name || '',
    senderPhone: maskPhone(shipment?.sender?.phone),
    receiverPhone: maskPhone(shipment?.receiver?.phone),
    senderEmail: maskEmail(shipment?.sender?.email),
    receiverEmail: maskEmail(shipment?.receiver?.email),
  };
}

function timelineDescription(status, location) {
  const place = locationText(location, 'logistics network');
  const templates = {
    'Shipment Created': `Shipment record created and pickup validation started at ${place}.`,
    'Pickup Scheduled': `Pickup slot scheduled with origin operations at ${place}.`,
    'Picked Up': `Package collected and custody scan completed at ${place}.`,
    'At Origin Hub': `Shipment arrived at origin hub for sorting at ${place}.`,
    'Departed Origin Hub': `Line-haul vehicle departed origin hub from ${place}.`,
    'In Transit': `Shipment is moving through the route corridor near ${place}.`,
    'At Destination Hub': `Shipment reached destination hub at ${place}.`,
    'Out For Delivery': `Last-mile delivery route started from ${place}.`,
    Delivered: `Delivery completed at ${place}.`,
    Delayed: `Shipment has a delay exception near ${place}.`,
    Exception: `Operational exception recorded at ${place}.`,
    Returned: `Return movement initiated at ${place}.`,
    Cancelled: `Shipment movement cancelled at ${place}.`,
  };
  return templates[normalizeStatus(status)] || `Shipment scan recorded at ${place}.`;
}

function buildTimeline(shipment, logistics) {
  const history = Array.isArray(shipment?.history) ? shipment.history : [];
  const normalizedHistory = history.map((entry) => {
    const status = normalizeStatus(entry.status);
    return {
      status,
      at: entry.at || entry.timestamp || entry.meta?.statusUpdatedAt || entry.meta?.createdAt || shipment?.updatedAt,
      location: entry.location || shipment?.currentLocation || shipment?.origin,
      description: entry.description || entry.meta?.note || timelineDescription(status, entry.location || shipment?.currentLocation),
      progressPercent: Number(entry.meta?.autoProgress) || statusProgress(status),
    };
  });

  if (normalizedHistory.length) return normalizedHistory;

  const createdAt = shipment?.createdAt ? new Date(shipment.createdAt) : new Date();
  const route = [
    ['Shipment Created', shipment?.origin, 0],
    ['Pickup Scheduled', shipment?.origin, 2],
    ['Picked Up', shipment?.origin, 6],
    ['At Origin Hub', shipment?.origin, 9],
    [logistics.status, shipment?.currentLocation || shipment?.origin, 14],
  ];
  return route.map(([status, location, hours]) => ({
    status: normalizeStatus(status),
    at: new Date(createdAt.getTime() + hours * 60 * 60 * 1000).toISOString(),
    location,
    description: timelineDescription(status, location),
    progressPercent: statusProgress(status),
  }));
}

function documentActions(trackingNumber) {
  const encoded = encodeURIComponent(trackingNumber || '');
  return [
    { label: 'Download Tracking PDF', url: `/api/shipments/${encoded}/documents/tracking-report` },
    { label: 'Download Invoice', url: `/api/shipments/${encoded}/documents/invoice` },
    { label: 'Download Manifest', url: `/api/shipments/${encoded}/documents/manifest` },
    { label: 'Shipping Label', url: `/api/shipments/${encoded}/documents/shipping-label` },
    { label: 'Proof Of Delivery', url: `/api/shipments/${encoded}/documents/proof-of-delivery` },
    { label: 'Print Tracking Report', url: `/api/shipments/${encoded}/documents/print-tracking-report` },
  ];
}

function enrichShipment(shipment) {
  const data = typeof shipment?.toObject === 'function' ? shipment.toObject() : { ...(shipment || {}) };
  const logistics = computeLogistics(data);
  data.status = logistics.status;
  data.currentStage = logistics.currentStage;
  data.estimatedDelivery = data.estimatedDelivery || logistics.estimatedDelivery;
  data.logistics = {
    ...(data.logistics || {}),
    totalDistanceKm: logistics.totalDistanceKm,
    coveredDistanceKm: logistics.coveredDistanceKm,
    remainingDistanceKm: logistics.remainingDistanceKm,
    averageSpeedKmph: logistics.averageSpeedKmph,
    deliveryConfidence: logistics.deliveryConfidence,
    expectedDelayMinutes: logistics.expectedDelayMinutes,
    weatherImpact: logistics.weatherImpact,
    weatherRiskScore: logistics.weatherRiskScore,
    lastGpsPingAt: logistics.lastGpsPingAt,
  };
  data.customerView = safeCustomerView(data);
  data.routeHistory = buildTimeline(data, logistics);
  data.documents = documentActions(data.trackingNumber);
  data.professionalStatuses = PROFESSIONAL_STATUSES;
  return data;
}

module.exports = {
  PROFESSIONAL_STATUSES,
  normalizeStatus,
  statusProgress,
  computeLogistics,
  enrichShipment,
  safeCustomerView,
};
