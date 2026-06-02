const WEATHER = [
  { label: 'Clear', icon: 'SUN', detail: 'Good visibility, no route weather delay expected', temp: 29 },
  { label: 'Cloudy', icon: 'CLD', detail: 'Normal movement conditions around this hub', temp: 24 },
  { label: 'Rain', icon: 'RAIN', detail: 'Wet roads can slow pickup or handoff by 1-3 hours', temp: 22 },
  { label: 'Hot', icon: 'HOT', detail: 'Heat-sensitive parcels may need extra handling care', temp: 34 },
];
const { normalizeStatus, statusProgress, computeLogistics } = require('./logisticsEngine');

function compactLocation(location, fallback = '-') {
  if (!location) return fallback;
  return location.text || [location.city, location.country].filter(Boolean).join(', ') || fallback;
}

function hashText(value) {
  return String(value || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function latestAutoProgress(shipment) {
  const history = Array.isArray(shipment?.history) ? shipment.history : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const progress = Number(history[index]?.meta?.autoProgress);
    if (Number.isFinite(progress)) return Math.max(0, Math.min(100, progress));
  }

  return statusProgress(shipment?.status);
}

function transportModeFor(shipment, progress) {
  const routeText = `${compactLocation(shipment?.origin, '')} ${compactLocation(shipment?.destination, '')}`.toLowerCase();

  if (progress >= 86) {
    return { key: 'bike', label: 'Bike', icon: 'BIKE', detail: 'Last-mile delivery near customer address' };
  }

  if (routeText.includes('airport') || routeText.includes('international') || progress < 36) {
    return { key: 'plane', label: 'Air freight', icon: 'AIR', detail: 'Fast hub-to-hub movement selected by AI' };
  }

  if (routeText.includes('rail') || progress < 64) {
    return { key: 'train', label: 'Rail line haul', icon: 'RAIL', detail: 'Regional hub transfer with lower delay risk' };
  }

  return { key: 'truck', label: 'Truck', icon: 'TRUCK', detail: 'Road transport toward destination city' };
}

function weatherFor(shipment) {
  const text = compactLocation(shipment?.currentLocation, compactLocation(shipment?.destination, 'current hub'));
  const item = WEATHER[hashText(text) % WEATHER.length];
  return {
    ...item,
    location: text,
    temp: item.temp + (hashText(text) % 4),
  };
}

function delayFor(shipment, progress, weather) {
  const eta = shipment?.estimatedDelivery ? new Date(shipment.estimatedDelivery) : null;
  const isLate = eta && !Number.isNaN(eta.getTime()) && eta.getTime() < Date.now() && String(shipment?.status) !== 'Delivered';
  const delayedHistory = (shipment?.history || []).filter((entry) => String(entry.status || '').toLowerCase().includes('delay')).length;
  const weatherRisk = weather.label === 'Rain' || weather.label === 'Hot';
  const isDelayed = Boolean(isLate || delayedHistory || (weatherRisk && progress < 95));

  if (isLate) {
    return { isDelayed: true, severity: 'High', reason: 'Estimated delivery window has passed; AI recommends hub escalation.' };
  }
  if (delayedHistory) {
    return { isDelayed: true, severity: 'Medium', reason: 'Previous delay scans found in shipment timeline.' };
  }
  if (weatherRisk) {
    return { isDelayed: true, severity: 'Low', reason: `${weather.label} near ${weather.location} may slow the next handoff.` };
  }
  if (progress < 20) {
    return { isDelayed: false, severity: 'None', reason: 'Parcel is in the first scan window; no delay detected yet.' };
  }
  return { isDelayed: false, severity: 'None', reason: 'AI found normal route movement and no active delay signal.' };
}

function etaConfidence(progress, delay) {
  const base = progress >= 86 ? 94 : progress >= 60 ? 88 : progress >= 25 ? 80 : 72;
  return Math.max(45, base - (delay.isDelayed ? 12 : 0));
}

function buildTimeline(shipment, progress) {
  const history = Array.isArray(shipment?.history) ? shipment.history : [];
  const items = history.slice(-8).reverse().map((entry) => {
    const entryProgress = Number(entry?.meta?.autoProgress);
    const status = normalizeStatus(entry.status || 'Update');
    return {
      status,
      at: entry.at || entry.timestamp || entry.meta?.autoUpdatedAt || entry.meta?.statusUpdatedAt || null,
      location: entry.location || null,
      progressPercent: Number.isFinite(entryProgress) ? Math.round(entryProgress) : null,
      description: entry.description || entry.meta?.note || '',
      detail: entry.meta?.autoTracked
        ? 'AI auto scan updated this route checkpoint.'
        : (entry.description || 'Manual or system scan recorded for this parcel.'),
    };
  });

  if (items.length) return items;

  return [
    {
      status: normalizeStatus(shipment?.status || 'Shipment Created'),
      at: shipment?.updatedAt || null,
      location: shipment?.currentLocation || shipment?.origin || null,
      progressPercent: Math.round(progress),
      detail: 'AI is waiting for the next parcel scan.',
    },
  ];
}

function buildTrackingInsights(shipment) {
  const logistics = computeLogistics(shipment);
  const progressPercent = latestAutoProgress(shipment);
  const transportMode = transportModeFor(shipment, progressPercent);
  const weather = weatherFor(shipment);
  const delay = delayFor(shipment, progressPercent, weather);
  const confidence = logistics.deliveryConfidence || etaConfidence(progressPercent, delay);
  const origin = compactLocation(shipment?.origin, 'origin hub');
  const destination = compactLocation(shipment?.destination, 'destination');
  const current = compactLocation(shipment?.currentLocation, 'current hub');

  return {
    progressPercent: Math.round(progressPercent),
    routeSummary: `${origin} -> ${destination}`,
    currentLocationText: current,
    currentStage: normalizeStatus(shipment?.status),
    transportMode,
    weather: {
      ...weather,
      riskScore: logistics.weatherRiskScore,
      impact: logistics.weatherImpact,
    },
    delay,
    etaConfidence: confidence,
    estimatedDelivery: shipment?.estimatedDelivery || logistics.estimatedDelivery || null,
    distance: {
      totalKm: logistics.totalDistanceKm,
      coveredKm: logistics.coveredDistanceKm,
      remainingKm: logistics.remainingDistanceKm,
      averageSpeedKmph: logistics.averageSpeedKmph,
    },
    expectedDelayMinutes: logistics.expectedDelayMinutes,
    lastGpsPingAt: logistics.lastGpsPingAt,
    timeline: buildTimeline(shipment, progressPercent),
    aiSummary: delay.isDelayed
      ? `AI detected a ${delay.severity.toLowerCase()} delay risk: ${delay.reason}`
      : `AI detects normal movement from ${origin} toward ${destination}.`,
  };
}

module.exports = { buildTrackingInsights };
