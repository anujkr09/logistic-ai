/*
  Notifications helper

  Used by customer-dashboard.html (notifCenter) and admin-dashboard.html (fraudAlerts / aiRecs can be separate).

  This script loads:
  - GET /api/notifications (customer notifications)
*/

(function () {
  const apiBase = window.__getApiBase?.() || window.API_BASE_URL || 'http://localhost:4000';

  function authHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  async function loadCustomerNotifications() {
    const r = await fetch(`${apiBase}/api/notifications`, { headers: authHeaders() });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || 'Failed to load notifications');
    return data;
  }

  function renderList(container, items) {
    if (!container) return;
    const list = items || [];
    container.textContent = '';
    if (!list.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No notifications';
      container.appendChild(empty);
      return;
    }

    list.forEach((n) => {
      const item = document.createElement('div');
      const title = document.createElement('div');
      const body = document.createElement('div');
      item.className = 'notif-item';
      if (n.type === 'fraud_alert') item.classList.add('alert-danger');
      title.className = 'notif-title';
      body.className = 'notif-body';
      title.textContent = n.title || 'Notification';
      body.textContent = n.message || '';
      item.append(title, body);
      container.appendChild(item);
    });
  }

  async function autoMount() {
    const container = document.getElementById('notifCenter');
    if (!container) return;

    // If already filled by inline script, don't override.
    const hasContent = (container.textContent || '').trim() !== '';
    if (hasContent) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const data = await loadCustomerNotifications();
      const items = data.notifications || data.items || [];
      renderList(container, items);
    } catch (e) {
      // silent
    }
  }

  window.__SHIPX_NOTIFICATIONS__ = { loadCustomerNotifications };
  document.addEventListener('DOMContentLoaded', autoMount);
})();

