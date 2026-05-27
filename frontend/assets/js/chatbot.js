/*
  Simple chatbot widget logic for customer/admin dashboards.

  Expected DOM ids (from customer-dashboard.html):
  - chatMessages
  - chatInput
  - chatSend

  Backend:
  - POST /api/chat { message }
*/

(function () {
  const messagesEl = document.getElementById('chatMessages');
  const inputEl = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');

  if (!messagesEl || !inputEl || !sendBtn) return;

  const apiBase = window.__getApiBase?.() || window.API_BASE_URL || 'http://localhost:4000';

  function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function appendBubble(text, role) {
    const div = document.createElement('div');
    div.className = `bubble ${role}`;
    div.textContent = text;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  sendBtn.addEventListener('click', async () => {
    const msg = (inputEl.value || '').trim();
    if (!msg) return;

    appendBubble(msg, 'user');
    inputEl.value = '';

    try {
      const r = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || 'Chat failed');

      appendBubble(data.reply || '-', 'bot');
    } catch (e) {
      appendBubble('AI service unavailable', 'bot');
    }
  });

  // Enter to send
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendBtn.click();
  });
})();

