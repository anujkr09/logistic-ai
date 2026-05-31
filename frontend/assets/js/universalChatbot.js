(function () {
  function getApiBase() {
    const base = window.__getApiBase?.() || window.API_BASE_URL || 'http://localhost:4000';
    return String(base).replace(/\/$/, '');
  }

  function getSocket() {
    try {
      if (!window.io) return null;
      const base = getApiBase();
      const socketUrl = base;
      if (!window.__zyraviqChatSocket) {
        window.__zyraviqChatSocket = window.io(socketUrl, {
          auth: { token: localStorage.getItem('token') || '' },
          transports: ['websocket', 'polling'],
        });
      }
      return window.__zyraviqChatSocket;
    } catch (_) {
      return null;
    }
  }

  function ensureWidget() {
    let widget = document.getElementById('chatbotWidget');
    if (!widget && document.getElementById('chatbotForm') && document.getElementById('chatbotMessages')) {
      return document;
    }
    if (widget) return widget;

    const existsToggle = document.getElementById('chatbotToggle');

    const widgetMarkup = `
      <div class="chatbot-widget" id="chatbotWidget" aria-hidden="true">
        <div class="chatbot-card">
          <div class="chatbot-header">
            <div>
              <h3>ZYRAVIQ AI Assistant</h3>
              <p>Ask about tracking, delays, weather, ETA, accounts, or admin tools.</p>
            </div>
            <button class="chatbot-close" id="chatbotClose" aria-label="Close chat">x</button>
          </div>
          <div class="chatbot-messages" id="chatbotMessages" role="log" aria-live="polite">
            <div class="chatbot-message bot" data-role="bot">Hi! I'm ZYRAVIQ AI. Ask me about tracking, delay reasons, weather, ETA, accounts, or admin tools.</div>
          </div>
          <form class="chatbot-form" id="chatbotForm">
            <input id="chatbotMessage" type="text" placeholder="Type your message..." aria-label="Type your message" autocomplete="off" />
            <button type="submit" class="btn btn-primary">Send</button>
          </form>
        </div>
      </div>
    `;

    const toggleMarkup = `
      <button class="chatbot-toggle" id="chatbotToggle" aria-label="Open chat" type="button">
        <span class="chatbot-toggle-icon">AI</span>
        <span>Chat</span>
      </button>
    `;

    // Default injection: add toggle first, then widget.
    // Avoid duplicates.
    if (!existsToggle) {
      document.body.insertAdjacentHTML('beforeend', toggleMarkup);
    }
    document.body.insertAdjacentHTML('beforeend', widgetMarkup);

    widget = document.getElementById('chatbotWidget');
    return widget;
  }

  function addMessage(messagesEl, text, role) {
    const div = document.createElement('div');
    div.className = `chatbot-message ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function createTyping(messagesEl) {
    const div = document.createElement('div');
    div.className = 'chatbot-message bot';
    div.innerHTML = `
      <span class="zyraviq-typing" aria-label="AI is typing">Typing</span>
    `;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function removeEl(el) {
    try {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    } catch (_) {}
  }

  function extractTrackingNumber(message) {
    if (!message) return null;
    const match = String(message).match(/\b[A-Z]{2,}-[A-Z0-9-]+\b|\b\d{4,}\b/i);
    if (!match) return null;
    return match[0];
  }

  function trackingPageContext() {
    return window.__ZYRAVIQ_TRACKING_CONTEXT__ || {};
  }

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (_) {
      return {};
    }
  }

  function contextualMessage(message) {
    const ctx = trackingPageContext();
    const user = getStoredUser();
    const role = ctx.viewerRole || user.role || localStorage.getItem('userRole') || 'guest';
    const name = ctx.viewerName || user.name || user.email || '';
    const activeTracking = ctx.trackingNumber || '';

    const contextLines = [
      name ? `Viewer name: ${name}` : '',
      `Viewer role: ${role}`,
      activeTracking ? `Current tracking dashboard number: ${activeTracking}` : '',
      ctx.shipmentStatus ? `Current shipment status: ${ctx.shipmentStatus}` : '',
      ctx.currentLocation ? `Current shipment location: ${ctx.currentLocation}` : '',
    ].filter(Boolean);

    const screenContext = ctx.screen ? `\n\n[Current tracking dashboard snapshot]\n${JSON.stringify(ctx.screen, null, 2)}` : '';
    if (!contextLines.length && !screenContext) return message;
    return `${message}\n\n[Page context]\n${contextLines.join('\n')}${screenContext}`;
  }

  function isHindiLike(message) {
    const text = String(message || '');
    if (/[\u0900-\u097F]/.test(text)) return true;
    return /\b(kya|kaise|kaha|kahan|kidhar|mera|meri|mere|hai|hoga|hogi|kab|kyu|kyun|batao|deliverd|delivered|delay|fraud)\b/i.test(text);
  }

  function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString([], {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function screenValue(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.text || value.city || value.name || value.label || '';
  }

  function directTrackingAnswer(message) {
    const ctx = trackingPageContext();
    const screen = ctx.screen || null;
    if (!screen?.trackingNumber) return null;

    const text = String(message || '').toLowerCase();
    const wantsEta = /\b(kab|when|eta|deliver|delivered|delivery|hoga|hogi|pahunche|arrive)\b/i.test(text);
    const wantsDelay = /\b(delay|late|der|late ho|ruk|hold|stuck)\b/i.test(text);
    const wantsLocation = /\b(where|kaha|kahan|kidhar|location|current|abhi|track|status)\b/i.test(text);
    const wantsFraud = /\b(fraud|scam|fake|risk|suspicious|report)\b/i.test(text);
    if (!wantsEta && !wantsDelay && !wantsLocation && !wantsFraud) return null;

    const hi = isHindiLike(message);
    const tracking = screen.trackingNumber;
    const status = screen.status || ctx.shipmentStatus || 'active';
    const statusLower = String(status).toLowerCase();
    const location = screenValue(screen.route?.current) || ctx.currentLocation || 'current hub';
    const origin = screenValue(screen.route?.origin);
    const destination = screenValue(screen.route?.destination);
    const eta = formatDateTime(screen.eta);
    const delivered = statusLower.includes('deliver');
    const delay = screen.delay || {};
    const fraud = screen.fraud || {};

    if (delivered && (wantsEta || wantsDelay || wantsLocation)) {
      return hi
        ? `Shipment ${tracking} already Delivered hai. Iska delivery pending nahi hai; current status Delivered show ho raha hai${location ? ` at ${location}` : ''}. Agar proof/time chahiye to timeline ka latest Delivered scan check karo.`
        : `Shipment ${tracking} is already Delivered. Delivery is not pending anymore; the current status is Delivered${location ? ` at ${location}` : ''}. Check the latest Delivered scan in the timeline for proof/time.`;
    }

    if (wantsFraud) {
      const riskScore = fraud.riskScore ?? fraud.score ?? null;
      const flagged = Boolean(fraud.isFlagged || fraud.flagged || (riskScore && Number(riskScore) > 0.5));
      const alertText = Array.isArray(fraud.alerts) && fraud.alerts.length ? fraud.alerts.join(', ') : '';
      if (hi) {
        return flagged
          ? `Shipment ${tracking} par fraud risk signal dikh raha hai${riskScore !== null ? `, risk score ${riskScore}` : ''}. Visible alert: ${alertText || 'suspicious activity'}. Isko fraud report section se admin ko report karo.`
          : `Shipment ${tracking} par abhi fraud flag visible nahi hai. Agar customer/admin ko kuch suspicious lag raha hai to fraud report bhej do, notification admin aur affected user ko jayegi.`;
      }
      return flagged
        ? `Shipment ${tracking} has a visible fraud-risk signal${riskScore !== null ? `, score ${riskScore}` : ''}. Alert: ${alertText || 'suspicious activity'}. Use the fraud report section to notify admin.`
        : `Shipment ${tracking} has no visible fraud flag right now. If anything looks suspicious, submit a fraud report so admin and the affected user are notified.`;
    }

    if (wantsDelay) {
      const reason = delay.reason || screen.aiSummary || 'No active delay reason is visible right now.';
      if (hi) {
        return delay.isDelayed
          ? `Shipment ${tracking} delayed dikh raha hai. Reason: ${reason}. Current location ${location}; ETA ${eta || 'pending'} hai.`
          : `Shipment ${tracking} me abhi active delay signal nahi dikh raha. Status ${status}, current location ${location}, ETA ${eta || 'pending'} hai.`;
      }
      return delay.isDelayed
        ? `Shipment ${tracking} is delayed. Reason: ${reason}. Current location: ${location}; ETA: ${eta || 'pending'}.`
        : `Shipment ${tracking} has no active delay signal right now. Status: ${status}; current location: ${location}; ETA: ${eta || 'pending'}.`;
    }

    if (wantsEta) {
      if (hi) return `Shipment ${tracking} ka status ${status} hai. ${eta ? `Expected delivery ${eta} hai.` : 'ETA abhi pending hai.'} Route: ${origin || 'origin'} se ${destination || 'destination'} tak, current location ${location}.`;
      return `Shipment ${tracking} status is ${status}. ${eta ? `Expected delivery is ${eta}.` : 'ETA is pending.'} Route: ${origin || 'origin'} to ${destination || 'destination'}, current location ${location}.`;
    }

    if (hi) return `Shipment ${tracking} abhi ${status} hai. Current location ${location}; route ${origin || 'origin'} se ${destination || 'destination'} tak hai. ETA ${eta || 'pending'} hai.`;
    return `Shipment ${tracking} is ${status}. Current location: ${location}; route: ${origin || 'origin'} to ${destination || 'destination'}. ETA: ${eta || 'pending'}.`;
  }

  function directHowToAnswer(message) {
    const text = String(message || '').toLowerCase();
    const asksTrackingHelp = (
      /\bhow\s+(do|to|can)\s+(i\s+)?track\b/i.test(text) ||
      /\btrack\s+(my\s+)?(shipment|parcel|package|order)\b/i.test(text) ||
      /\btracking\s+(kaise|kahan|kaha|help|process)\b/i.test(text) ||
      /\bshipment\s+kaise\s+track\b/i.test(text)
    );
    if (!asksTrackingHelp) return null;

    if (isHindiLike(message)) {
      return [
        'Shipment track karne ke liye:',
        '1. Tracking page open karo.',
        '2. Apna tracking number paste karo, jaise ZQ-8042 ya ZQ-604547.',
        '3. Track button dabao.',
        '4. App current location, status, route, ETA, weather, delay reason, transport mode aur timeline dikhayega.',
        'Agar tracking number nahi hai to sender/admin se full tracking number lo.',
      ].join('\n');
    }

    return [
      'To track a shipment:',
      '1. Open the Tracking page.',
      '2. Paste your tracking number, for example ZQ-8042 or ZQ-604547.',
      '3. Click Track.',
      '4. The app will show current location, status, route, ETA, weather, delay reason, transport mode, and timeline.',
      'If you do not have a tracking number, ask the sender/admin for the full tracking number.',
    ].join('\n');
  }

  async function restChat(payload) {
    const apiBase = getApiBase();

    const r = await fetch(`${apiBase}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(localStorage.getItem('token')
          ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || data?.detail || `status ${r.status}`);
    return data;
  }

  async function publicChat(payload) {
    const apiBase = getApiBase();
    const r = await fetch(`${apiBase}/api/ai/public/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: payload.message, trackingNumber: payload.trackingNumber }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || data?.detail || `status ${r.status}`);
    return data;
  }

  function initWidgetBehavior() {
    ensureWidget();

    const chatbotToggle = document.getElementById('chatbotToggle');
    const chatbotWidget = document.getElementById('chatbotWidget') || document;
    const chatbotClose = document.getElementById('chatbotClose');
    const chatbotForm = document.getElementById('chatbotForm');
    const inputEl = document.getElementById('chatbotMessage');
    const messagesEl = document.getElementById('chatbotMessages');

    if (!chatbotForm || !inputEl || !messagesEl) return;

    function toggleChatbot(show) {
      if (!document.getElementById('chatbotWidget')) return;
      chatbotWidget.classList.toggle('active', show);
      chatbotWidget.setAttribute('aria-hidden', show ? 'false' : 'true');
    }

    chatbotToggle?.addEventListener('click', () => toggleChatbot(true));
    chatbotClose?.addEventListener('click', () => toggleChatbot(false));

    // Suggested questions (simple, role-agnostic)
    const suggested = [
      'Where is my parcel?',
      'Why is my shipment delayed?',
      'How do I open an account?',
      'What can admin dashboard do?',
    ];

    // Inject suggestion row once
    if (!document.getElementById('chatbotSuggestions')) {
      const suggestionRow = document.createElement('div');
      suggestionRow.id = 'chatbotSuggestions';
      suggestionRow.style.padding = '0 22px 12px';
      suggestionRow.style.display = 'flex';
      suggestionRow.style.gap = '10px';
      suggestionRow.style.flexWrap = 'wrap';
      suggestionRow.style.background = '#f8f8fb';
      suggestionRow.style.borderTop = '1px solid rgba(0,0,0,.04)';

      suggested.forEach((q) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = q;
        btn.style.border = '1px solid rgba(0,0,0,.12)';
        btn.style.borderRadius = '999px';
        btn.style.padding = '8px 12px';
        btn.style.cursor = 'pointer';
        btn.style.background = '#fff';
        btn.style.color = '#4d148c';
        btn.style.fontWeight = '800';
        btn.style.fontSize = '12px';
        btn.addEventListener('click', () => {
          inputEl.value = q;
          inputEl.focus();
        });
        suggestionRow.appendChild(btn);
      });

      // place before messages only if possible
      const suggestionHost = document.getElementById('chatbotWidget')?.querySelector('.chatbot-card');
      if (suggestionHost) suggestionHost.insertBefore(suggestionRow, suggestionHost.querySelector('#chatbotMessages'));
    }

    let sending = false;

    async function sendMessage(messageText) {
      const msg = String(messageText || '').trim();
      if (!msg) return;
      if (sending) return;
      sending = true;

      const pageCtx = trackingPageContext();
      const trackingNumber = extractTrackingNumber(msg) || pageCtx.trackingNumber || null;
      const outboundMessage = contextualMessage(msg);

      addMessage(messagesEl, msg, 'user');
      inputEl.value = '';

      const directAnswer = directTrackingAnswer(msg);
      if (directAnswer) {
        addMessage(messagesEl, directAnswer, 'bot');
        sending = false;
        return;
      }

      const howToAnswer = directHowToAnswer(msg);
      if (howToAnswer) {
        addMessage(messagesEl, howToAnswer, 'bot');
        sending = false;
        return;
      }

      const typingEl = createTyping(messagesEl);

      // Prefer socket streaming if available
      const socket = getSocket();
      const useSocket = socket && socket.connected;

      try {
        if (useSocket) {
          const chatSessionId = crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());

          let botBubble = null;

          const onToken = ({ sessionId, delta } = {}) => {
            if (sessionId !== chatSessionId) return;
            if (!botBubble) {
              botBubble = addMessage(messagesEl, '', 'bot');
            }
            botBubble.textContent = (botBubble.textContent || '') + (delta || '');
          };

          const onDone = ({ sessionId } = {}) => {
            if (sessionId !== chatSessionId) return;
            removeEl(typingEl);
            socket.off('chat:token', onToken);
            socket.off('chat:done', onDone);
            socket.off('chat:error', onError);
          };

          const onError = ({ sessionId, message } = {}) => {
            if (sessionId !== chatSessionId) return;
            removeEl(typingEl);
            addMessage(messagesEl, message || 'AI error', 'bot');
            socket.off('chat:token', onToken);
            socket.off('chat:done', onDone);
            socket.off('chat:error', onError);
          };

          socket.on('chat:token', onToken);
          socket.on('chat:done', onDone);
          socket.on('chat:error', onError);

          socket.emit('chat:message', {
            sessionId: chatSessionId,
            message: outboundMessage,
            trackingNumber,
            role: pageCtx.viewerRole || localStorage.getItem('userRole') || undefined,
          });
        } else {
          let data;
          try {
            data = await restChat({ message: outboundMessage, trackingNumber });
          } catch (authErr) {
            data = await publicChat({ message: outboundMessage, trackingNumber });
          }
          removeEl(typingEl);
          addMessage(messagesEl, data?.reply || 'Sorry, I could not generate a response.', 'bot');
        }
      } catch (e) {
        removeEl(typingEl);
        addMessage(messagesEl, 'AI service unavailable', 'bot');
      } finally {
        sending = false;
      }
    }

    chatbotForm.addEventListener('submit', (event) => {
      event.preventDefault();
      sendMessage(inputEl.value);
    });

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') chatbotForm.requestSubmit();
    });
  }

  // basic typing indicator styling
  function ensureTypingCss() {
    if (document.getElementById('zyraviq-chatbot-typing-css')) return;
    const style = document.createElement('style');
    style.id = 'zyraviq-chatbot-typing-css';
    style.textContent = `
      .zyraviq-typing::after{content:"";display:inline-block;width:1.2em;}
    `;
    document.head.appendChild(style);
  }

  // Init once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureTypingCss();
      initWidgetBehavior();
    });
  } else {
    ensureTypingCss();
    initWidgetBehavior();
  }
})();

