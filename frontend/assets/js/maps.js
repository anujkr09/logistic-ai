function escapeMapText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function compactLocation(location, fallback) {
  if (!location) return fallback;
  return location.text || [location.city, location.country].filter(Boolean).join(', ') || fallback;
}

function coordinatesFor(location) {
  const raw = location?.coordinates;
  if (Array.isArray(raw) && raw.length >= 2) {
    const lng = Number(raw[0]);
    const lat = Number(raw[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }

  return approximateCoordinates(location);
}

function approximateCoordinates(location) {
  const text = compactLocation(location, '').toLowerCase();
  const cityCoordinates = [
    ['mumbai', { lat: 19.076, lng: 72.8777 }],
    ['delhi', { lat: 28.7041, lng: 77.1025 }],
    ['new delhi', { lat: 28.6139, lng: 77.209 }],
    ['bengaluru', { lat: 12.9716, lng: 77.5946 }],
    ['bangalore', { lat: 12.9716, lng: 77.5946 }],
    ['hyderabad', { lat: 17.385, lng: 78.4867 }],
    ['chennai', { lat: 13.0827, lng: 80.2707 }],
    ['kolkata', { lat: 22.5726, lng: 88.3639 }],
    ['pune', { lat: 18.5204, lng: 73.8567 }],
    ['ahmedabad', { lat: 23.0225, lng: 72.5714 }],
    ['jaipur', { lat: 26.9124, lng: 75.7873 }],
    ['surat', { lat: 21.1702, lng: 72.8311 }],
    ['lucknow', { lat: 26.8467, lng: 80.9462 }],
    ['indore', { lat: 22.7196, lng: 75.8577 }],
    ['kochi', { lat: 9.9312, lng: 76.2673 }],
    ['goa', { lat: 15.2993, lng: 74.124 }],
    ['india', { lat: 20.5937, lng: 78.9629 }],
    ['london', { lat: 51.5072, lng: -0.1276 }],
    ['new york', { lat: 40.7128, lng: -74.006 }],
    ['dubai', { lat: 25.2048, lng: 55.2708 }],
    ['singapore', { lat: 1.3521, lng: 103.8198 }],
  ];
  const match = cityCoordinates.find(([name]) => text.includes(name));
  if (match) return match[1];
  if (!text) return null;

  const seed = hashText(text);
  return {
    lat: 8 + (seed % 2600) / 100,
    lng: 68 + ((seed * 7) % 2800) / 100,
  };
}

function locationRegion(location) {
  const text = compactLocation(location, '').toLowerCase();
  const regions = [
    ['mumbai', 'Maharashtra, India'],
    ['pune', 'Maharashtra, India'],
    ['nagpur', 'Maharashtra, India'],
    ['delhi', 'Delhi, India'],
    ['new delhi', 'Delhi, India'],
    ['bengaluru', 'Karnataka, India'],
    ['bangalore', 'Karnataka, India'],
    ['hyderabad', 'Telangana, India'],
    ['chennai', 'Tamil Nadu, India'],
    ['kolkata', 'West Bengal, India'],
    ['ahmedabad', 'Gujarat, India'],
    ['surat', 'Gujarat, India'],
    ['jaipur', 'Rajasthan, India'],
    ['lucknow', 'Uttar Pradesh, India'],
    ['indore', 'Madhya Pradesh, India'],
    ['kochi', 'Kerala, India'],
    ['goa', 'Goa, India'],
    ['dubai', 'Dubai, UAE'],
    ['singapore', 'Singapore'],
    ['london', 'England, United Kingdom'],
    ['new york', 'New York, United States'],
  ];
  const match = regions.find(([name]) => text.includes(name));
  if (match) return match[1];
  return location?.country || 'Route region';
}

function pointLabel(location, fallback) {
  return compactLocation(location, fallback);
}

function routePoint(id, label, location, kind, status = '') {
  const coordinates = coordinatesFor(location);
  if (!coordinates) return null;
  const lowerStatus = String(status || '').toLowerCase();
  return {
    id,
    label,
    region: locationRegion(location),
    position: coordinates,
    kind,
    status,
    delayed: lowerStatus.includes('delay') || lowerStatus.includes('hold') || lowerStatus.includes('exception'),
    diverted: lowerStatus.includes('divert') || lowerStatus.includes('reroute') || lowerStatus.includes('route change'),
  };
}

function interpolatePoint(a, b, ratio, bend = 0) {
  const lat = a.lat + (b.lat - a.lat) * ratio;
  const lng = a.lng + (b.lng - a.lng) * ratio;
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  return {
    lat: lat + (-dx / length) * bend,
    lng: lng + (dy / length) * bend,
  };
}

function syntheticCorridor(origin, destination) {
  if (!origin || !destination) return [];
  const distance = Math.hypot(destination.lat - origin.lat, destination.lng - origin.lng);
  const bend = Math.min(3.4, Math.max(0.9, distance * 0.18));
  return [
    { id: 'corridor-1', label: 'Regional hub', region: 'Transit corridor', position: interpolatePoint(origin, destination, 0.28, bend), kind: 'hub' },
    { id: 'corridor-2', label: 'Line-haul checkpoint', region: 'Transit corridor', position: interpolatePoint(origin, destination, 0.58, -bend * 0.65), kind: 'hub' },
  ];
}

function dedupeRoutePoints(points) {
  const seen = new Set();
  return points.filter((point) => {
    if (!point?.position) return false;
    const key = `${Math.round(point.position.lat * 20)}:${Math.round(point.position.lng * 20)}:${point.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildRoutePlan(location, shipment = {}) {
  const originPoint = routePoint('origin', pointLabel(shipment.origin, 'Origin hub'), shipment.origin, 'origin', 'Origin');
  const destinationPoint = routePoint('destination', pointLabel(shipment.destination, 'Destination'), shipment.destination, 'destination', 'Destination');
  const history = Array.isArray(shipment.history) ? shipment.history : [];
  const historyPoints = history
    .map((entry, index) => routePoint(`scan-${index}`, pointLabel(entry.location, entry.status || 'Scan'), entry.location, 'scan', entry.status))
    .filter(Boolean);
  const currentPoint = routePoint('current', pointLabel(location || shipment.currentLocation, 'Current location'), location || shipment.currentLocation, 'current', shipment.status || 'Current');
  const generated = syntheticCorridor(originPoint?.position, destinationPoint?.position);

  let points = dedupeRoutePoints([
    originPoint,
    ...historyPoints,
    ...generated,
    currentPoint,
    destinationPoint,
  ]);

  if (originPoint && destinationPoint) {
    points = points.sort((a, b) => {
      if (a.kind === 'origin') return -1;
      if (b.kind === 'origin') return 1;
      if (a.kind === 'destination') return 1;
      if (b.kind === 'destination') return -1;
      const total = Math.hypot(destinationPoint.position.lat - originPoint.position.lat, destinationPoint.position.lng - originPoint.position.lng) || 1;
      const progressA = Math.hypot(a.position.lat - originPoint.position.lat, a.position.lng - originPoint.position.lng) / total;
      const progressB = Math.hypot(b.position.lat - originPoint.position.lat, b.position.lng - originPoint.position.lng) / total;
      return progressA - progressB;
    });
  }

  const delay = shipment.aiInsights?.delay;
  const hasDelay = Boolean(delay?.isDelayed || points.some((point) => point.delayed));
  const hasDiversion = points.some((point) => point.diverted);
  return { points, hasDelay, hasDiversion, delay };
}

function hashText(value) {
  return String(value || '').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function progressForStatus(status) {
  const steps = ['Created', 'In Transit', 'Arrived', 'Out for Delivery', 'Delivered'];
  const index = Math.max(0, steps.indexOf(status || 'Created'));
  return Math.round((index / (steps.length - 1)) * 100);
}

function progressForShipment(shipment = {}) {
  const insightProgress = Number(shipment.aiInsights?.progressPercent);
  if (Number.isFinite(insightProgress)) return Math.max(0, Math.min(100, insightProgress));

  const history = Array.isArray(shipment.history) ? shipment.history : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const progress = Number(history[index]?.meta?.autoProgress);
    if (Number.isFinite(progress)) return Math.max(0, Math.min(100, progress));
  }

  return progressForStatus(shipment.status);
}

function modeForShipment(shipment = {}) {
  if (shipment.aiInsights?.transportMode) return shipment.aiInsights.transportMode;

  const status = String(shipment.status || '').toLowerCase();
  const routeText = `${compactLocation(shipment.origin, '')} ${compactLocation(shipment.destination, '')}`.toLowerCase();
  const progress = progressForShipment(shipment);

  if (status.includes('out for delivery') || progress >= 75) {
    return { key: 'bike', label: 'Bike', detail: 'Last-mile delivery near customer address', icon: 'BIKE' };
  }

  if (routeText.includes('airport') || routeText.includes('international') || progress < 40) {
    return { key: 'plane', label: 'Plane', detail: 'Air freight between major hubs', icon: 'AIR' };
  }

  if (routeText.includes('rail') || routeText.includes('terminal') || progress < 65) {
    return { key: 'train', label: 'Train', detail: 'Rail line haul between regional hubs', icon: 'RAIL' };
  }

  return { key: 'truck', label: 'Truck', detail: 'Road transport to destination city', icon: 'TRUCK' };
}

function weatherForLocation(location) {
  const text = compactLocation(location, 'Current location');
  const conditions = [
    { label: 'Clear', icon: 'SUN', detail: 'Good visibility for movement', temp: 29 },
    { label: 'Cloudy', icon: 'CLD', detail: 'Normal route conditions', temp: 24 },
    { label: 'Rain', icon: 'RAIN', detail: 'Wet roads may slow handoff', temp: 22 },
    { label: 'Hot', icon: 'HOT', detail: 'Heat-sensitive parcels need care', temp: 34 },
  ];
  const item = conditions[hashText(text) % conditions.length];
  return { ...item, location: text, temp: item.temp + (hashText(text) % 4) };
}

function routeStages(activeMode) {
  return [
    { key: 'plane', label: 'Air hub', icon: 'AIR' },
    { key: 'train', label: 'Rail hub', icon: 'RAIL' },
    { key: 'truck', label: 'Road hub', icon: 'TRUCK' },
    { key: 'bike', label: 'Last mile', icon: 'BIKE' },
  ].map((stage) => ({ ...stage, active: stage.key === activeMode.key }));
}

function googleMapsApiKey() {
  return window.GOOGLE_MAPS_API_KEY || localStorage.getItem('googleMapsApiKey') || '';
}

function loadGoogleMaps() {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (window.__shipxGoogleMapsPromise) return window.__shipxGoogleMapsPromise;

  const key = googleMapsApiKey();
  if (!key) return Promise.reject(new Error('Google Maps API key missing'));

  window.__shipxGoogleMapsPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Google Maps took too long to load')), 4500);
    const callbackName = `__shipxGoogleMapsReady_${Date.now()}`;
    window[callbackName] = () => {
      clearTimeout(timer);
      delete window[callbackName];
      resolve(window.google.maps);
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Google Maps failed to load'));
    };
    document.head.appendChild(script);
  });

  return window.__shipxGoogleMapsPromise;
}

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (window.__shipxLeafletPromise) return window.__shipxLeafletPromise;

  window.__shipxLeafletPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('OpenStreetMap took too long to load')), 4500);
    const cssId = 'leaflet-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      clearTimeout(timer);
      resolve(window.L);
    };
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error('OpenStreetMap failed to load'));
    };
    document.head.appendChild(script);
  });

  return window.__shipxLeafletPromise;
}

function fallbackMapTemplate({ origin, current, destination, status, eta, mode, weather, progress, fraudFlag, fraudMessage, empty, reason }) {
  const stages = routeStages(mode);
  const currentLeft = 12 + progress * 0.72;
  const activeWidth = Math.max(8, progress * 0.72);

  return `
    <div class="route-map ${empty ? 'route-map--empty' : ''}">
      <div class="map-provider-badge">${escapeMapText(reason || 'Google Maps key required')}</div>
      <div class="map-skyline" aria-hidden="true"></div>
      <div class="map-gridlines"></div>
      <div class="world-map"></div>
      <svg class="route-svg" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">
        <path class="route-svg-line" d="M8 32 C28 6, 42 42, 58 18 S82 12, 92 28" />
        <path class="route-svg-active" pathLength="100" style="stroke-dasharray:${activeWidth} 100" d="M8 32 C28 6, 42 42, 58 18 S82 12, 92 28" />
      </svg>
      <div class="map-pin map-pin-origin">
        <span class="pin-dot"></span>
        <div class="pin-label"><b>Origin</b><span>${escapeMapText(origin)}</span></div>
      </div>
      <div class="map-pin map-pin-current" style="left:${currentLeft}%">
        <span class="pin-dot pin-dot-live"></span>
        <div class="pin-label pin-label-strong"><b>Parcel now</b><span>${escapeMapText(current)}</span></div>
      </div>
      <div class="parcel-marker" style="left:${currentLeft}%"><span>${escapeMapText(mode.icon)}</span></div>
      <div class="map-pin map-pin-destination">
        <span class="pin-dot"></span>
        <div class="pin-label"><b>Destination</b><span>${escapeMapText(destination)}</span></div>
      </div>
      <div class="map-insights">
        <div class="map-card transport-card">
          <span class="map-card-icon mode-${escapeMapText(mode.key)}">${escapeMapText(mode.icon)}</span>
          <div><b>${escapeMapText(mode.label)}</b><span>${escapeMapText(mode.detail)}</span></div>
        </div>
        <div class="map-card weather-card">
          <span class="map-card-icon weather-icon">${escapeMapText(weather.icon)}</span>
          <div><b>${escapeMapText(weather.label)} ${escapeMapText(weather.temp)}C</b><span>${escapeMapText(weather.detail)}</span></div>
        </div>
      </div>
      ${routeCorridorTemplate({ origin, destination, progress, routePlan: buildRoutePlan(null, { origin: { text: origin }, destination: { text: destination }, currentLocation: { text: current }, status }), empty })}
      <div class="route-stages">
        ${stages.map((stage) => `
          <div class="route-stage ${stage.active ? 'active' : ''}">
            <span>${escapeMapText(stage.icon)}</span>
            <b>${escapeMapText(stage.label)}</b>
          </div>
        `).join('')}
      </div>
      ${fraudFlag ? `<div class="fraud-alert"><strong>Fraud watch</strong><span>${escapeMapText(fraudMessage)}</span></div>` : ''}
      <div class="map-status"><span>${escapeMapText(status)}</span><b>ETA ${escapeMapText(eta)}</b></div>
    </div>
  `;
}

function buildMapState(location, shipment = {}, empty = false) {
  const origin = compactLocation(shipment.origin, 'Origin hub');
  const current = compactLocation(location, empty ? 'Waiting for scan' : 'Current location');
  const destination = compactLocation(shipment.destination, 'Destination');
  const status = shipment.status || (empty ? 'Waiting for tracking number' : 'In transit');
  const eta = shipment.estimatedDelivery ? new Date(shipment.estimatedDelivery).toLocaleDateString() : (empty ? 'pending' : 'Pending');
  const mode = modeForShipment(shipment);
  const weather = shipment.aiInsights?.weather || (empty
    ? { label: 'Pending', icon: 'WX', detail: 'Weather appears with parcel location', temp: '--' }
    : weatherForLocation(location));
  const progress = progressForShipment(shipment);
  const fraudRisk = shipment.fraud?.riskScore ?? shipment.fraudRisk;
  const fraudFlag = Boolean(shipment.fraud?.isFlagged || fraudRisk >= 40);
  const fraudMessage = fraudFlag
    ? (shipment.fraud?.alerts?.join('; ') || shipment.fraudMessage || `Potential fraud risk detected: ${fraudRisk || 'elevated'}%`)
    : '';

  const routePlan = buildRoutePlan(location, shipment);

  return { origin, current, destination, status, eta, mode, weather, progress, fraudFlag, fraudMessage, empty, routePlan };
}

function googleMarkerIcon(color) {
  return {
    path: 'M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z',
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2,
    scale: 1.5,
    anchor: new google.maps.Point(12, 22),
  };
}

function leafletMarkerIcon(color, label) {
  return L.divIcon({
    className: 'leaflet-shipx-marker',
    html: `<span style="background:${escapeMapText(color)}">${escapeMapText(label)}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

function routePointColor(point) {
  if (point.delayed) return '#ef4444';
  if (point.diverted) return '#f97316';
  if (point.kind === 'origin') return '#17324d';
  if (point.kind === 'destination') return '#14b8a6';
  if (point.kind === 'current') return '#0e8f87';
  return '#6366f1';
}

function routePointShort(point, index) {
  if (point.kind === 'origin') return 'O';
  if (point.kind === 'destination') return 'D';
  if (point.kind === 'current') return 'C';
  if (point.delayed) return '!';
  if (point.diverted) return 'R';
  return String(index + 1);
}

function routeCorridorTemplate(state) {
  const points = state.routePlan?.points || [];
  const visible = points.slice(0, 7);
  const delayText = state.routePlan?.hasDelay
    ? (state.routePlan.delay?.reason || 'Delay marker found on this route.')
    : 'No active delay marker';
  const diversionText = state.routePlan?.hasDiversion ? 'Diversion/reroute marker found' : 'No diversion marker';
  return `
    <div class="map-route-panel">
      <div class="map-route-panel__head">
        <div><span>Route corridor</span><b>${escapeMapText(state.origin)} to ${escapeMapText(state.destination)}</b></div>
        <strong>${escapeMapText(Math.round(state.progress))}%</strong>
      </div>
      <div class="map-route-flags">
        <span class="${state.routePlan?.hasDelay ? 'is-alert' : ''}">${escapeMapText(delayText)}</span>
        <span class="${state.routePlan?.hasDiversion ? 'is-warn' : ''}">${escapeMapText(diversionText)}</span>
      </div>
      <div class="map-route-list">
        ${visible.map((point, index) => `
          <div class="map-route-stop ${point.kind === 'current' ? 'active' : ''} ${point.delayed ? 'delayed' : ''} ${point.diverted ? 'diverted' : ''}">
            <i>${escapeMapText(routePointShort(point, index))}</i>
            <div><b>${escapeMapText(point.label)}</b><span>${escapeMapText(point.region)}${point.status ? ` - ${escapeMapText(point.status)}` : ''}</span></div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function resolveRoutePoints(location, shipment = {}) {
  const routePlan = buildRoutePlan(location, shipment);
  const origin = routePlan.points.find((point) => point.kind === 'origin')?.position || coordinatesFor(shipment.origin);
  const current = routePlan.points.find((point) => point.kind === 'current')?.position || coordinatesFor(location);
  const destination = routePlan.points.find((point) => point.kind === 'destination')?.position || coordinatesFor(shipment.destination);
  return { origin, current, destination, routePlan, points: routePlan.points.map((point) => point.position).filter(Boolean) };
}

async function renderGoogleMap(element, location, shipment = {}, empty = false) {
  const maps = await loadGoogleMaps();
  const { origin, current, destination, routePlan, points } = resolveRoutePoints(location, shipment);
  const fallbackCenter = { lat: 20.5937, lng: 78.9629 };
  const center = current || origin || destination || fallbackCenter;

  element.innerHTML = `
    <div class="google-map-shell">
      <div class="google-map-canvas"></div>
      <div class="google-map-overlay"></div>
    </div>
  `;

  const canvas = element.querySelector('.google-map-canvas');
  const overlay = element.querySelector('.google-map-overlay');
  const map = new maps.Map(canvas, {
    center,
    zoom: points.length ? 6 : 4,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
    backgroundColor: '#eef5f7',
    styles: [
      { featureType: 'poi', stylers: [{ visibility: 'off' }] },
      { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
    ],
  });

  const bounds = new maps.LatLngBounds();
  const markers = routePlan.points.filter((item) => item.position);

  markers.forEach((item, index) => {
    bounds.extend(item.position);
    const marker = new maps.Marker({
      map,
      position: item.position,
      title: `${item.label}: ${item.region}`,
      icon: googleMarkerIcon(routePointColor(item)),
    });
    const info = new maps.InfoWindow({
      content: `<div class="map-info-window"><b>${escapeMapText(routePointShort(item, index))}. ${escapeMapText(item.label)}</b><span>${escapeMapText(item.region)}</span><span>${escapeMapText(item.status || '')}</span></div>`,
    });
    marker.addListener('click', () => info.open({ map, anchor: marker }));
  });

  if (points.length >= 2) {
    new maps.Polyline({
      map,
      path: points,
      geodesic: true,
      strokeColor: '#0e8f87',
      strokeOpacity: 0.9,
      strokeWeight: 4,
    });
    new maps.Polyline({
      map,
      path: points.slice(0, Math.max(2, Math.ceil(points.length * (progressForShipment(shipment) / 100)))),
      geodesic: true,
      strokeColor: '#ef4444',
      strokeOpacity: routePlan.hasDelay ? 0.9 : 0,
      strokeWeight: 5,
    });
  }

  if (points.length > 1) {
    map.fitBounds(bounds, 64);
  }

  setTimeout(() => {
    maps.event.trigger(map, 'resize');
    if (points.length > 1) map.fitBounds(bounds, 64);
  }, 120);

  const state = buildMapState(location, shipment, empty);
  overlay.innerHTML = `
    <div class="google-map-summary">
      <div><span>Status</span><b>${escapeMapText(state.status)}</b></div>
      <div><span>Mode</span><b>${escapeMapText(state.mode.label)}</b></div>
      <div><span>ETA</span><b>${escapeMapText(state.eta)}</b></div>
    </div>
    ${routeCorridorTemplate(state)}
  `;
}

async function renderLeafletMap(element, location, shipment = {}, empty = false) {
  const L = await loadLeaflet();
  const { origin, current, destination, routePlan, points } = resolveRoutePoints(location, shipment);
  const fallbackCenter = { lat: 20.5937, lng: 78.9629 };
  const center = current || origin || destination || fallbackCenter;

  element.innerHTML = `
    <div class="google-map-shell leaflet-map-shell">
      <div class="google-map-canvas leaflet-map-canvas"></div>
      <div class="google-map-overlay"></div>
    </div>
  `;

  const canvas = element.querySelector('.leaflet-map-canvas');
  const overlay = element.querySelector('.google-map-overlay');
  const map = L.map(canvas, {
    zoomControl: true,
    attributionControl: true,
  }).setView([center.lat, center.lng], points.length ? 6 : 4);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  const bounds = [];
  const markers = routePlan.points.filter((item) => item.position);

  markers.forEach((item, index) => {
    const latLng = [item.position.lat, item.position.lng];
    bounds.push(latLng);
    L.marker(latLng, { icon: leafletMarkerIcon(routePointColor(item), routePointShort(item, index)) })
      .addTo(map)
      .bindPopup(`<div class="map-info-window"><b>${escapeMapText(routePointShort(item, index))}. ${escapeMapText(item.label)}</b><span>${escapeMapText(item.region)}</span><span>${escapeMapText(item.status || '')}</span></div>`);
  });

  if (points.length >= 2) {
    L.polyline(points.map((point) => [point.lat, point.lng]), {
      color: '#0e8f87',
      weight: 4,
      opacity: 0.9,
    }).addTo(map);
    if (routePlan.hasDelay) {
      const activeCount = Math.max(2, Math.ceil(points.length * (progressForShipment(shipment) / 100)));
      L.polyline(points.slice(0, activeCount).map((point) => [point.lat, point.lng]), {
        color: '#ef4444',
        weight: 5,
        opacity: 0.88,
      }).addTo(map);
    }
  }

  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [46, 46] });
  }

  const state = buildMapState(location, shipment, empty);
  overlay.innerHTML = `
    <div class="google-map-summary">
      <div><span>Map</span><b>OpenStreetMap</b></div>
      <div><span>Status</span><b>${escapeMapText(state.status)}</b></div>
      <div><span>ETA</span><b>${escapeMapText(state.eta)}</b></div>
    </div>
    ${routeCorridorTemplate(state)}
  `;

  const refreshLeafletSize = () => {
    map.invalidateSize();
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30] });
  };
  setTimeout(refreshLeafletSize, 80);
  setTimeout(refreshLeafletSize, 260);
  window.addEventListener('resize', refreshLeafletSize, { passive: true, once: true });
}

function renderProviderMap(element, location, shipment = {}, empty = false) {
  if (googleMapsApiKey()) {
    return renderGoogleMap(element, location, shipment, empty)
      .catch(() => renderLeafletMap(element, location, shipment, empty));
  }

  return renderLeafletMap(element, location, shipment, empty);
}

function renderFallbackMap(element, location, shipment = {}, empty = false, reason = '') {
  const state = buildMapState(location, shipment, empty);
  element.innerHTML = fallbackMapTemplate({ ...state, reason });
  window.__MAP_DETAILS = { mode: state.mode, weather: state.weather };
}

function upgradeToProviderMap(element, location, shipment = {}, empty = false) {
  renderProviderMap(element, location, shipment, empty)
    .catch(() => {
      const providerBadge = element.querySelector('.map-provider-badge');
      if (providerBadge) providerBadge.textContent = 'Smart route preview';
    });
}

window.__MAP_INIT = function () {
  const element = document.getElementById('map');
  if (!element) return;

  const placeholderShipment = {
    status: 'Waiting for tracking number',
    origin: { text: 'Warehouse hub', coordinates: [72.8777, 19.076] },
    currentLocation: { text: 'Waiting for scan', coordinates: [77.1025, 28.7041] },
    destination: { text: 'Delivery city', coordinates: [77.5946, 12.9716] },
  };

  renderFallbackMap(element, placeholderShipment.currentLocation, placeholderShipment, true, 'Smart route preview');
  upgradeToProviderMap(element, placeholderShipment.currentLocation, placeholderShipment, true);
};

window.__MAP_UPDATE = function (location, shipment = {}) {
  const element = document.getElementById('map');
  if (!element) return;

  if (!location) {
    window.__MAP_INIT();
    return;
  }

  const state = buildMapState(location, shipment, false);
  window.__MAP_DETAILS = { mode: state.mode, weather: state.weather };

  renderFallbackMap(element, location, shipment, false, 'Smart route preview');
  upgradeToProviderMap(element, location, shipment, false);
};
