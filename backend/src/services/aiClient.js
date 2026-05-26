const fetch = global.fetch || require('node-fetch');

const AI_SERVICE_URL = (
  process.env.AI_SERVICE_URL ||
  (process.env.AI_SERVICE_HOSTPORT ? `http://${process.env.AI_SERVICE_HOSTPORT}` : '') ||
  'http://localhost:8001'
).replace(/\/$/, '');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.2';
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

async function callAi(path, body) {
  const res = await fetch(`${AI_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI call failed ${res.status}: ${text}`);
  }
  return res.json();
}

async function* callAiStream(path, body) {
  const res = await fetch(`${AI_SERVICE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI stream call failed ${res.status}: ${text}`);
  }

  const reader = res.body?.getReader?.();
  if (!reader) {
    const full = await res.text();
    yield full || '';
    return;
  }

  const decoder = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) yield chunk;
    }
  }
}


// New generic dispatcher endpoint in AI service
async function executeAi(actionType, payload) {
  return callAi('/execute', { actionType, payload });
}

async function validateLocation({ address, city, country }) {
  try {
    return await executeAi('validate-location', { address, city, country });
  } catch (e) {
    return { normalized: { address, city, country }, validated: false, confidence: 0 };
  }
}

async function predictEta({ origin, destination, delayHistory }) {
  try {
    return await executeAi('predict-eta', { origin, destination, delayHistory });
  } catch (e) {
    const etaDays = Math.max(1, Math.min(7, 2 + Math.ceil((delayHistory || []).length / 2)));
    const estimatedDelivery = new Date(Date.now() + etaDays * 24 * 60 * 60 * 1000).toISOString();
    return { estimatedDelivery, etaDays, risk: 0.15 };
  }
}

async function detectFraud({ trackingNumber, history }) {
  try {
    return await executeAi('detect-fraud', { trackingNumber, history });
  } catch (e) {
    return { fraud: false, riskScore: 0, alerts: [] };
  }
}

async function recommendRoute({ origin, destination, companyId }) {
  try {
    return await executeAi('recommend', { origin, destination, companyId });
  } catch (e) {
    return { fastest: null, cheapest: null, bestWarehouse: null, details: {} };
  }
}

async function analyzeTracking({ shipment }) {
  try {
    return await executeAi('tracking-insights', { shipment });
  } catch (e) {
    const { buildTrackingInsights } = require('./trackingInsights');
    return buildTrackingInsights(shipment);
  }
}

function compactShipmentContext(context = {}) {
  const shipment = context.shipment || null;
  const lookup = context.recommendations?.lookup || null;
  return {
    role: context.role || 'customer',
    companyId: context.companyId || null,
    trackingNumber: context.trackingNumber || shipment?.trackingNumber || null,
    shipment: shipment ? {
      trackingNumber: shipment.trackingNumber,
      status: shipment.status,
      origin: shipment.origin,
      destination: shipment.destination,
      currentLocation: shipment.currentLocation,
      estimatedDelivery: shipment.estimatedDelivery,
      fraud: shipment.fraud,
      latestHistory: Array.isArray(shipment.history) ? shipment.history.slice(-5) : [],
      aiInsights: shipment.aiInsights,
    } : null,
    lookup: lookup ? {
      requestedTracking: lookup.requestedTracking,
      tried: lookup.tried,
      suggestedTracking: lookup.suggestedTracking,
    } : null,
  };
}

function openAiInstructions({ role }) {
  return [
    'You are shipX AI Assistant for a logistics web app.',
    'Always answer in the same language style as the user message: Hindi/Devanagari for Hindi, Hinglish for Hinglish, and English for English.',
    'If the user mixes Hindi and English, reply in natural Hinglish with short Hindi explanations and logistics terms in English when useful.',
    'Use the provided shipment context as the source of truth. Do not invent tracking status, ETA, location, payment, fraud, or account details.',
    'If a tracking number is missing or not found, ask for the full tracking number and suggest the available tracking number only when it is present in context.',
    'For fraud or suspicious activity, explain what signal is visible, advise the user to report it in the app, and avoid accusing a person unless the context explicitly proves it.',
    'For admin users, you may explain dashboard actions like create shipment, update status, assign warehouse, fraud scan, and AI recommendations.',
    'Keep answers clear, practical, and concise. Use bullet points only when they help.',
    `Current user role: ${role || 'customer'}.`,
  ].join('\n');
}

function preferredLanguage(message) {
  const text = String(message || '');
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  const lower = text.toLowerCase();
  const hinglishWords = [
    'kya', 'kaise', 'kaha', 'kahan', 'kidhar', 'mera', 'meri', 'mere', 'hai',
    'hoga', 'hogi', 'nahi', 'nahin', 'kyu', 'kyun', 'kab', 'bhejo', 'batao',
    'puchhe', 'kar', 'karo', 'fraud', 'shipment kaha', 'delay kyu',
  ];
  return hinglishWords.some((word) => lower.includes(word)) ? 'hi' : 'en';
}

function extractOpenAiText(data) {
  if (data?.output_text) return String(data.output_text).trim();
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && content.text) parts.push(content.text);
      if (content?.text && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function extractScreenSnapshot(message) {
  const text = String(message || '');
  const marker = '[Current tracking dashboard snapshot]';
  const index = text.indexOf(marker);
  if (index === -1) return null;

  const afterMarker = text.slice(index + marker.length).trim();
  const jsonStart = afterMarker.indexOf('{');
  if (jsonStart === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = jsonStart; i < afterMarker.length; i += 1) {
    const char = afterMarker[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(afterMarker.slice(jsonStart, i + 1));
        } catch (e) {
          return null;
        }
      }
    }
  }
  return null;
}

function readPlace(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value.text || value.city || value.name || value.label || '';
}

function formatEta(value) {
  if (!value) return 'pending';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function normalizedScreenShipment(message, context = {}) {
  if (context?.shipment) return null;
  const screen = extractScreenSnapshot(message);
  if (!screen?.trackingNumber) return null;
  return {
    trackingNumber: screen.trackingNumber,
    status: screen.status,
    origin: readPlace(screen.route?.origin),
    destination: readPlace(screen.route?.destination),
    currentLocation: readPlace(screen.route?.current),
    estimatedDelivery: screen.eta,
    delay: screen.delay || null,
    fraud: screen.fraud || null,
    aiSummary: screen.aiSummary || '',
  };
}

function projectHowToAnswer(message) {
  const text = String(message || '').toLowerCase();
  const asksTrackingHelp = (
    /\bhow\s+(do|to|can)\s+(i\s+)?track\b/i.test(text) ||
    /\btrack\s+(my\s+)?(shipment|parcel|package|order)\b/i.test(text) ||
    /\btracking\s+(kaise|kahan|kaha|help|process)\b/i.test(text) ||
    /\bshipment\s+kaise\s+track\b/i.test(text)
  );

  if (!asksTrackingHelp) return null;

  const hi = preferredLanguage(message) === 'hi';
  if (hi) {
    return {
      reply: [
        'Shipment track karne ke liye:',
        '1. Tracking page open karo.',
        '2. Apna tracking number paste karo, jaise SX-8042 ya SX-604547.',
        '3. Track button dabao.',
        '4. App current location, status, route, ETA, weather, delay reason, transport mode aur timeline dikhayega.',
        'Agar tracking number nahi hai to sender/admin se full tracking number lo.',
      ].join('\n'),
    };
  }

  return {
    reply: [
      'To track a shipment:',
      '1. Open the Tracking page.',
      '2. Paste your tracking number, for example SX-8042 or SX-604547.',
      '3. Click Track.',
      '4. The app will show current location, status, route, ETA, weather, delay reason, transport mode, and timeline.',
      'If you do not have a tracking number, ask the sender/admin for the full tracking number.',
    ].join('\n'),
  };
}

async function callOpenAiChat({ message, trackingNumber, companyId, context, role }) {
  if (!OPENAI_API_KEY) return null;

  const groundedContext = compactShipmentContext({
    ...(context || {}),
    role,
    companyId,
    trackingNumber,
  });

  const res = await fetch(`${OPENAI_BASE_URL}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions: openAiInstructions({ role }),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                `User message: ${message}`,
                '',
                'Available app context JSON:',
                JSON.stringify(groundedContext, null, 2),
              ].join('\n'),
            },
          ],
        },
      ],
      max_output_tokens: 700,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.error?.message || data?.message || `OpenAI call failed ${res.status}`;
    throw new Error(detail);
  }

  const reply = extractOpenAiText(data);
  return reply ? { reply } : null;
}

function fallbackChat({ message, trackingNumber, context }) {
  const lang = preferredLanguage(message);
  const hi = lang === 'hi';
  const normalized = String(message || '').toLowerCase();
  const screenShipment = normalizedScreenShipment(message, context);
  const shipment = context?.shipment || screenShipment || null;
  const insights = shipment?.aiInsights || null;
  const wantsShipmentAnswer = normalized.includes('where') || normalized.includes('track') || normalized.includes('parcel') || normalized.includes('package') || normalized.includes('status') || normalized.includes('kaha') || normalized.includes('kahan') || normalized.includes('kidhar') || normalized.includes('kab') || normalized.includes('when') || normalized.includes('eta') || normalized.includes('deliver') || normalized.includes('hoga') || normalized.includes('hogi') || normalized.includes('delay') || normalized.includes('late') || normalized.includes('fraud');
  if (shipment && wantsShipmentAnswer) {
    const status = shipment.status || 'active';
    const location = readPlace(shipment.currentLocation) || 'current hub';
    const eta = formatEta(shipment.estimatedDelivery);
    const delivered = String(status).toLowerCase().includes('deliver');
    const delayObj = shipment.delay || insights?.delay || {};
    const fraudObj = shipment.fraud || {};
    const delay = delayObj?.reason || shipment.aiSummary || 'No active delay signal found.';
    const mode = insights?.transportMode?.label || 'AI estimating';
    const weather = insights?.weather ? `${insights.weather.label} ${insights.weather.temp}C` : 'pending';
    if (delivered && (normalized.includes('kab') || normalized.includes('when') || normalized.includes('eta') || normalized.includes('deliver') || normalized.includes('delay'))) {
      if (hi) return { reply: `Shipment ${shipment.trackingNumber} already Delivered hai. Delivery pending nahi hai; current status Delivered hai${location ? ` aur latest location ${location}` : ''}. Timeline me latest Delivered scan se proof/time check kar sakte ho.` };
      return { reply: `Shipment ${shipment.trackingNumber} is already Delivered. Delivery is not pending; current status is Delivered${location ? ` and latest location is ${location}` : ''}. Check the latest Delivered scan in the timeline for proof/time.` };
    }
    if (normalized.includes('fraud')) {
      const riskScore = fraudObj?.riskScore ?? fraudObj?.score ?? null;
      const flagged = Boolean(fraudObj?.isFlagged || fraudObj?.flagged || (riskScore && Number(riskScore) > 0.5));
      if (hi) return { reply: flagged ? `Shipment ${shipment.trackingNumber} par fraud risk signal dikh raha hai${riskScore !== null ? `, score ${riskScore}` : ''}. Fraud report submit karo, admin aur affected user ko notification jayegi.` : `Shipment ${shipment.trackingNumber} par abhi fraud flag visible nahi hai. Agar kuch suspicious lag raha hai to fraud report submit karo, notification admin aur affected user ko jayegi.` };
      return { reply: flagged ? `Shipment ${shipment.trackingNumber} has a visible fraud-risk signal${riskScore !== null ? `, score ${riskScore}` : ''}. Submit a fraud report so admin and the affected user are notified.` : `Shipment ${shipment.trackingNumber} has no visible fraud flag right now. If anything looks suspicious, submit a fraud report so admin and the affected user are notified.` };
    }
    if (normalized.includes('delay') || normalized.includes('late')) {
      const delayed = Boolean(delayObj?.isDelayed || (delayObj?.severity && delayObj.severity !== 'none'));
      if (hi) return { reply: delayed ? `Shipment ${shipment.trackingNumber} delayed dikh raha hai. Reason: ${delay}. Current location ${location}; ETA ${eta} hai.` : `Shipment ${shipment.trackingNumber} me abhi active delay signal nahi dikh raha. Status ${status}, current location ${location}, ETA ${eta} hai.` };
      return { reply: delayed ? `Shipment ${shipment.trackingNumber} is delayed. Reason: ${delay}. Current location: ${location}; ETA: ${eta}.` : `Shipment ${shipment.trackingNumber} has no active delay signal right now. Status: ${status}; current location: ${location}; ETA: ${eta}.` };
    }
    if (hi) return { reply: `Shipment ${shipment.trackingNumber} abhi ${status} hai aur location ${location} hai. Mode: ${mode}. Weather: ${weather}. ETA: ${eta}. Delay check: ${delay}` };
    return { reply: `Shipment ${shipment.trackingNumber} is ${status} at ${location}. Mode: ${mode}. Weather: ${weather}. ETA: ${eta}. Delay check: ${delay}` };
  }
  if (normalized.includes('admin') || normalized.includes('dashboard')) {
    if (hi) return { reply: 'Admin dashboard me aap shipments create kar sakte ho, warehouse assign kar sakte ho, analytics dekh sakte ho, fraud alerts scan kar sakte ho, AI recommendations le sakte ho, aur live tracking monitor kar sakte ho.' };
    return { reply: 'Admin dashboard lets you create shipments, assign warehouses, view analytics, fraud alerts, AI recommendations, and monitor live tracking updates.' };
  }
  if (normalized.includes('account') || normalized.includes('register') || normalized.includes('signup')) {
    if (hi) return { reply: 'shipX account banane ke liye Register/Open account page open karo. Existing user login karke apne role ke hisaab se customer ya admin dashboard use kar sakta hai.' };
    return { reply: 'Open the Register/Open account page to create a shipX workspace. Existing users can login and then use customer/admin dashboards based on role.' };
  }
  if (trackingNumber) {
    const lookup = context?.recommendations?.lookup;
    const tried = lookup?.tried?.length ? ` I also checked ${lookup.tried.slice(0, 3).join(', ')}.` : '';
    const suggested = lookup?.suggestedTracking ? ` You can try the active shipment ${lookup.suggestedTracking}, or paste the full tracking number on the Tracking page.` : ' Please paste the full shipX tracking number, for example SX-8042 or SX-604547.';
    if (hi) {
      const triedHi = lookup?.tried?.length ? ` Maine ${lookup.tried.slice(0, 3).join(', ')} bhi check kiya.` : '';
      const suggestedHi = lookup?.suggestedTracking ? ` Aap active shipment ${lookup.suggestedTracking} try kar sakte ho, ya Tracking page par full tracking number paste karo.` : ' Kripya full shipX tracking number paste karo, jaise SX-8042 ya SX-604547.';
      return { reply: `${trackingNumber} ke liye exact shipment nahi mila.${triedHi}${suggestedHi}` };
    }
    return { reply: `I could not find an exact shipment for ${trackingNumber}.${tried}${suggested}` };
  }
  if (normalized.includes('where') || normalized.includes('parcel') || normalized.includes('package')) {
    if (hi) return { reply: 'Apna tracking number bhejo, main shipment status, current hub, aur ETA check kar dunga.' };
    return { reply: 'Share your tracking number and I will check the shipment status, current hub, and ETA.' };
  }
  if (normalized.includes('delay') || normalized.includes('late')) {
    if (hi) return { reply: 'Delay ke possible reasons hub congestion, route change, weather, ya address verification ho sakte hain. Latest scan ke liye tracking page check karo.' };
    return { reply: 'Possible delay reasons include hub congestion, route changes, weather, or address verification. Check the tracking page for the latest scan.' };
  }
  if (hi) return { reply: 'Main shipment status, delivery ETA, route updates, warehouse assignment, aur fraud-risk checks me help kar sakta hoon.' };
  return { reply: 'I can help with shipment status, delivery ETA, route updates, warehouse assignment, and fraud-risk checks.' };
}

async function chat({ message, trackingNumber, companyId, context, role }) {
  const howTo = projectHowToAnswer(message);
  if (howTo) return howTo;

  if (OPENAI_API_KEY) {
    try {
      const openAiReply = await callOpenAiChat({ message, trackingNumber, companyId, context, role });
      if (openAiReply) return openAiReply;
    } catch (e) {
      // Fall through to the existing local AI service and deterministic fallback.
    }
  }

  try {
    // keep existing non-streaming endpoint
    return await executeAi('chat', { message, trackingNumber, companyId, context, role });
  } catch (e) {
    return fallbackChat({ message, trackingNumber, context });
  }
}

async function* streamChat({ message, trackingNumber, companyId, context, role }) {
  const howTo = projectHowToAnswer(message);
  if (howTo) {
    yield howTo.reply;
    return;
  }

  if (OPENAI_API_KEY) {
    try {
      const openAiReply = await callOpenAiChat({ message, trackingNumber, companyId, context, role });
      if (openAiReply?.reply) {
        yield openAiReply.reply;
        return;
      }
    } catch (e) {
      // Fall through to the existing streaming service.
    }
  }

  // true streaming from python service /stream-chat
  try {
    yield* callAiStream('/stream-chat', { message, trackingNumber, companyId, context: { role, companyId, trackingNumber, ...(context || {}) } });
  } catch (e) {
    yield fallbackChat({ message, trackingNumber, context }).reply;
  }
}



module.exports = { validateLocation, predictEta, detectFraud, recommendRoute, analyzeTracking, chat, streamChat };


