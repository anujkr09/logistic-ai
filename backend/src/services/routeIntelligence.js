const fetch = global.fetch || require('node-fetch');

const WEATHER_API_URL = process.env.WEATHER_API_URL || '';
const TRAFFIC_API_URL = process.env.TRAFFIC_API_URL || '';
const ROAD_ALERTS_API_URL = process.env.ROAD_ALERTS_API_URL || '';

async function getJson(url, payload) {
  if (!url) return null;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) return null;
    return response.json();
  } catch (error) {
    return null;
  }
}

function fallbackRouteRisk(shipment = {}) {
  const text = `${shipment.origin?.text || ''} ${shipment.currentLocation?.text || ''} ${shipment.destination?.text || ''}`.toLowerCase();
  const rain = text.includes('prayagraj') || text.includes('kolkata') || text.includes('mumbai');
  const congestion = text.includes('delhi') || text.includes('kanpur') || text.includes('bangalore');

  return {
    provider: 'deterministic-fallback',
    weather: rain
      ? { condition: 'Heavy Rain', alert: 'Rain corridor detected on route.', delayMinutes: 80, riskScore: 62 }
      : { condition: 'Clear', alert: 'No weather-related delays expected.', delayMinutes: 0, riskScore: 5 },
    traffic: congestion
      ? { condition: 'Moderate congestion', delayMinutes: 35, riskScore: 38 }
      : { condition: 'Normal', delayMinutes: 0, riskScore: 8 },
    road: { condition: 'Open', alert: 'No road closure alert on active route.', riskScore: 4 },
  };
}

async function routeRisk(shipment) {
  const payload = {
    trackingNumber: shipment?.trackingNumber,
    origin: shipment?.origin,
    currentLocation: shipment?.currentLocation,
    destination: shipment?.destination,
    routeCode: shipment?.routeCode,
  };

  const [weather, traffic, road] = await Promise.all([
    getJson(WEATHER_API_URL, payload),
    getJson(TRAFFIC_API_URL, payload),
    getJson(ROAD_ALERTS_API_URL, payload),
  ]);

  const fallback = fallbackRouteRisk(shipment);
  return {
    provider: weather || traffic || road ? 'external-provider' : fallback.provider,
    weather: weather || fallback.weather,
    traffic: traffic || fallback.traffic,
    road: road || fallback.road,
  };
}

module.exports = { routeRisk };
