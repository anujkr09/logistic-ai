/* Dashboard logic for admin and customer screens */
(function () {
  const apiBase = window.__getApiBase?.() || window.API_BASE_URL || 'http://localhost:4000';

  function getToken() {
    return localStorage.getItem('token');
  }

  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function showToast(message) {
    window.__showToast?.(message);
  }

  function markActiveNav() {
    const current = location.pathname.split('/').pop();
    document.querySelectorAll('.side-link').forEach((link) => {
      const target = link.getAttribute('href')?.split('/').pop();
      link.classList.toggle('active', target === current);
    });
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function locationText(location) {
    if (!location) return '-';
    if (typeof location === 'string') return location;
    return location.text || [location.city, location.country].filter(Boolean).join(', ') || '-';
  }

  function formatDate(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function etaState(shipment) {
    if (!shipment?.estimatedDelivery) return { label: 'ETA pending', className: 'status-neutral' };
    if (shipment.status === 'Delivered') return { label: 'Delivered', className: 'status-delivered' };
    const eta = new Date(shipment.estimatedDelivery);
    if (Number.isNaN(eta.getTime())) return { label: 'ETA pending', className: 'status-neutral' };
    return eta < new Date()
      ? { label: 'Delayed', className: 'status-danger' }
      : { label: 'On schedule', className: 'status-success' };
  }

  function statusClass(status) {
    const value = String(status || '').toLowerCase();
    if (value.includes('delivered')) return 'status-delivered';
    if (value.includes('delay') || value.includes('exception') || value.includes('failed')) return 'status-danger';
    if (value.includes('transit') || value.includes('out')) return 'status-active';
    if (value.includes('arrived')) return 'status-success';
    return 'status-neutral';
  }

  function normalizeList(data) {
    return data.items || data.shipments || data.notifications || data.alerts || data.recommendations || [];
  }

  function setError(container, message) {
    if (!container) return;
    container.innerHTML = `<div class="empty-state compact error-state"><strong>Could not load</strong><span>${escapeHtml(message)}</span></div>`;
  }

  function copyText(value) {
    if (!value) return;
    navigator.clipboard?.writeText(value)
      .then(() => showToast('Tracking number copied'))
      .catch(() => showToast('Copy failed'));
  }

  function requireLogin() {
    if (getToken()) return true;
    location.href = './login.html';
    return false;
  }

  function currentRole() {
    return localStorage.getItem('userRole') || '';
  }

  function isAdminRole() {
    const role = currentRole();
    return role === 'admin' || role === 'warehouse_manager';
  }

  function currentPage() {
    const path = location.pathname.split('/').pop();
    if (path === 'admin-dashboard.html') return 'admin';
    if (path === 'customer-dashboard.html') return 'customer';
    return 'other';
  }

  function setupLogout() {
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
      localStorage.removeItem('userRole');
      localStorage.removeItem('companyId');
      location.href = './login.html';
    });
  }

  function getStoredUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }

  function setStoredUser(user) {
    if (!user) return;
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('userRole', user.role || '');
    localStorage.setItem('companyId', user.companyId || '');
  }

  async function fetchJson(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        ...authHeaders(),
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || 'Request failed');
    return data;
  }

  function formatPhone(phone = {}) {
    if (phone.fullNumber) return phone.fullNumber;
    return [phone.countryCode, phone.number].filter(Boolean).join(' ') || '-';
  }

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'A';
    return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  function roleLabel(role) {
    if (role === 'warehouse_manager') return 'Warehouse manager';
    if (role === 'admin') return 'Admin';
    return role ? role.replace(/_/g, ' ') : 'Operations';
  }

  function renderAdminIdentity(user = getStoredUser()) {
    const nameEl = document.getElementById('adminName');
    const roleEl = document.getElementById('adminRole');
    const avatarEl = document.getElementById('adminAvatar');
    if (!nameEl || !roleEl || !avatarEl) return;

    const displayName = user.name || user.email || 'Admin';
    const detail = [roleLabel(user.role), user.companyName].filter(Boolean).join(' - ');
    nameEl.textContent = displayName;
    roleEl.textContent = detail || 'Operations';
    avatarEl.textContent = initials(displayName);
  }

  async function loadAdminIdentity() {
    if (!document.getElementById('adminIdentity')) return;
    renderAdminIdentity();
    try {
      const data = await fetchJson('/api/auth/me');
      if (data.user) {
        setStoredUser(data.user);
        renderAdminIdentity(data.user);
      }
    } catch (error) {
      renderAdminIdentity();
    }
  }

  function renderProfile(user = getStoredUser()) {
    const profileName = document.getElementById('profileName');
    if (!profileName) return;

    profileName.textContent = user.name || '-';
    document.getElementById('profileEmail').textContent = user.email || '-';
    document.getElementById('profilePhone').textContent = formatPhone(user.phone);
    document.getElementById('profileCompany').textContent = user.companyName || '-';
    document.getElementById('profilePan').textContent = user.panNumber || '-';
    document.getElementById('profileGst').textContent = user.gstNumber || '-';
    document.getElementById('profileRole').textContent = user.role === 'admin' ? 'Admin' : 'Customer';
  }

  async function loadProfile() {
    if (!document.getElementById('profileName')) return;
    renderProfile();
    try {
      const data = await fetchJson('/api/auth/me');
      if (data.user) {
        setStoredUser(data.user);
        renderProfile(data.user);
      }
    } catch (error) {
      showToast(error.message);
    }
  }

  async function loadAdminStats() {
    const statTotal = document.getElementById('statTotal');
    if (!statTotal) return;

    try {
      const data = await fetchJson('/api/analytics/admin/summary');
      document.getElementById('statTotal').textContent = data.totalShipments ?? 0;
      document.getElementById('statDelayed').textContent = data.delayedShipments ?? 0;
      document.getElementById('statDelivered').textContent = data.deliveredShipments ?? 0;
      document.getElementById('statRevenue').textContent = `$${data.revenue ?? 0}`;
    } catch (error) {
      showToast(error.message);
    }
  }

  async function loadAdminAlerts() {
    const fraudAlerts = document.getElementById('fraudAlerts');
    const aiRecs = document.getElementById('aiRecs');
    if (!fraudAlerts && !aiRecs) return;

    try {
      if (fraudAlerts) {
        const data = await fetchJson('/api/fraud/alerts');
        renderNotificationList(fraudAlerts, normalizeList(data), {
          emptyTitle: 'No fraud alerts',
          emptyBody: 'Flagged shipment activity will appear here.',
          kind: 'danger',
          action: 'Track',
        });
      }

      if (aiRecs) {
        const data = await fetchJson('/api/ai/recommendations');
        renderNotificationList(aiRecs, normalizeList(data), {
          emptyTitle: 'No AI recommendations yet',
          emptyBody: 'Create warehouses and shipments to receive routing suggestions.',
          kind: 'info',
        });
      }
    } catch (error) {
      showToast(error.message);
    }
  }

  function setupIntelligenceActions() {
    const scanBtn = document.getElementById('scanFraudBtn');
    const refreshBtn = document.getElementById('refreshRecsBtn');

    scanBtn?.addEventListener('click', async () => {
      scanBtn.disabled = true;
      try {
        const data = await fetchJson('/api/fraud/scan', { method: 'POST' });
        showToast(`Fraud scan complete: ${data.flagged || 0} flagged`);
        await Promise.all([loadAdminStats(), loadAdminAlerts(), loadAdminShipments()]);
      } catch (error) {
        showToast(error.message);
      } finally {
        scanBtn.disabled = false;
      }
    });

    refreshBtn?.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      try {
        const data = await fetchJson('/api/ai/recommendations/refresh', { method: 'POST' });
        const aiRecs = document.getElementById('aiRecs');
        if (aiRecs) {
          renderNotificationList(aiRecs, normalizeList(data), {
            emptyTitle: 'No AI recommendations yet',
            emptyBody: 'Create warehouses and shipments to receive routing suggestions.',
            kind: 'info',
          });
        }
        showToast('AI recommendations refreshed');
      } catch (error) {
        showToast(error.message);
      } finally {
        refreshBtn.disabled = false;
      }
    });
  }

  async function loadAdminShipments() {
    const container = document.getElementById('shipmentsAdmin');
    if (!container) return;

    try {
      const data = await fetchJson('/api/shipments');
      renderShipmentList(container, normalizeList(data), {
        role: 'admin',
        emptyTitle: 'No shipments created',
        emptyBody: 'Use Create shipment to add the first package to operations.',
      });
    } catch (error) {
      setError(container, error.message);
    }
  }

  async function loadCustomerShipments() {
    const container = document.getElementById('shipmentsTable');
    if (!container) return;

    try {
      const data = await fetchJson('/api/shipments');
      renderShipmentList(container, normalizeList(data), {
        role: 'customer',
        emptyTitle: 'No shipment history',
        emptyBody: 'Your shipments and delivery progress will appear here.',
      });
    } catch (error) {
      setError(container, error.message);
    }
  }

  function renderNotificationList(container, items, options = {}) {
    const list = items || [];
    if (!list.length) {
      container.innerHTML = `<div class="empty-state compact"><strong>${escapeHtml(options.emptyTitle || 'Nothing to show')}</strong><span>${escapeHtml(options.emptyBody || 'Updates will appear here.')}</span></div>`;
      return;
    }

    container.innerHTML = `
      ${list.map((item) => {
        const trackingNumber = item.trackingNumber || item.meta?.trackingNumber || '';
        const score = item.riskScore || item.score;
        const priority = item.priority || (options.kind === 'danger' ? 'High' : '');
        return `
          <article class="notif-item ${options.kind === 'danger' ? 'alert-danger' : ''} ${item.type ? `rec-${escapeHtml(item.type)}` : ''}">
            <div class="notif-head">
              <div class="notif-title">${escapeHtml(item.title || 'Update')}</div>
              <div class="notif-chips">
                ${priority ? `<span class="mini-chip priority-chip">${escapeHtml(priority)}</span>` : ''}
                ${score != null ? `<span class="mini-chip">${escapeHtml(score)}${options.kind === 'danger' ? '% risk' : ' score'}</span>` : ''}
              </div>
            </div>
            <div class="notif-body">${escapeHtml(item.reason || item.details || item.message || 'Review this operational update.')}</div>
            <div class="notif-meta">
              <span>${escapeHtml(formatDateTime(item.updatedAt || item.createdAt))}</span>
              ${trackingNumber ? `<a class="link" href="./tracking.html?tracking=${encodeURIComponent(trackingNumber)}">${escapeHtml(options.action || 'View shipment')}</a>` : ''}
            </div>
          </article>
        `;
      }).join('')}
    `;
  }

  function renderShipmentList(container, items, options = {}) {
    const list = items || [];
    if (!list.length) {
      container.innerHTML = `<div class="empty-state"><strong>${escapeHtml(options.emptyTitle || 'No shipments yet')}</strong><span>${escapeHtml(options.emptyBody || 'Shipment activity will appear here.')}</span></div>`;
      return;
    }

    const role = options.role || 'customer';
    const statuses = [...new Set(list.map((shipment) => shipment.status).filter(Boolean))];
    const tableId = `${container.id || 'shipments'}Table`;
    const summary = `${list.length} shipment${list.length === 1 ? '' : 's'}`;

    const statusOptions = ['Created', 'In Transit', 'Arrived', 'Out for Delivery', 'Delivered', 'Delayed'];

    container.innerHTML = `
      <div class="list-toolbar" data-list-toolbar>
        <div>
          <div class="list-title">${role === 'admin' ? 'Operations shipment list' : 'Your shipment history'}</div>
          <div class="list-subtitle">${summary} loaded. Search by tracking, route, status, or location.</div>
        </div>
        <div class="list-controls">
          <input class="input list-search" type="search" placeholder="Search shipments" data-list-search aria-label="Search shipments" />
          <select class="select list-filter" data-list-status aria-label="Filter by status">
            <option value="">All statuses</option>
            ${statuses.map((status) => `<option value="${escapeHtml(status)}">${escapeHtml(status)}</option>`).join('')}
          </select>
        </div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Tracking</th>
            <th>Route</th>
            ${role === 'admin' ? '<th>Current / Warehouse</th>' : '<th>Current location</th>'}
            <th>Status</th>
            <th>ETA</th>
            ${role === 'admin' ? '<th>Risk</th>' : ''}
            <th>Updated</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody id="${tableId}">
          ${list.map((shipment) => {
            const trackingNumber = shipment.trackingNumber || '-';
            const route = `${locationText(shipment.origin)} -> ${locationText(shipment.destination)}`;
            const current = locationText(shipment.currentLocation);
            const eta = etaState(shipment);
            const riskScore = shipment.fraud?.riskScore ?? 0;
            const riskLabel = shipment.fraud?.isFlagged ? `${riskScore}% flagged` : 'Clear';
            const searchText = [trackingNumber, route, current, shipment.status, riskLabel].join(' ').toLowerCase();
            return `
            <tr data-list-row data-status="${escapeHtml(shipment.status || '')}" data-search="${escapeHtml(searchText)}">
              <td>
                <div class="tracking-cell">
                  <strong>${escapeHtml(trackingNumber)}</strong>
                  <button class="table-action" type="button" data-copy="${escapeHtml(trackingNumber)}">Copy</button>
                </div>
              </td>
              <td>
                <div class="route-cell">
                  <span>${escapeHtml(locationText(shipment.origin))}</span>
                  <span>${escapeHtml(locationText(shipment.destination))}</span>
                </div>
              </td>
              <td>
                <div class="route-cell">
                  <span>${escapeHtml(current)}</span>
                  ${role === 'admin' ? `<span>${escapeHtml(shipment.warehouseId ? 'Warehouse assigned' : 'No warehouse assigned')}</span>` : ''}
                </div>
              </td>
              <td><span class="badge ${statusClass(shipment.status)}">${escapeHtml(shipment.status || 'Created')}</span></td>
              <td>
                <div class="route-cell">
                  <span>${escapeHtml(formatDate(shipment.estimatedDelivery))}</span>
                  <span class="${eta.className}">${escapeHtml(eta.label)}</span>
                </div>
              </td>
              ${role === 'admin' ? `<td><span class="badge ${shipment.fraud?.isFlagged ? 'status-danger' : 'status-success'}">${escapeHtml(riskLabel)}</span></td>` : ''}
              <td>${escapeHtml(formatDateTime(shipment.updatedAt || shipment.createdAt))}</td>
              <td>
                <div class="table-actions">
                  <a class="link" href="./tracking.html?tracking=${encodeURIComponent(trackingNumber)}">Track</a>
                  ${role === 'admin' ? `
                    <select class="select status-update-select" data-status-select="${escapeHtml(trackingNumber)}" aria-label="Update status for ${escapeHtml(trackingNumber)}">
                      ${statusOptions.map((option) => `<option value="${escapeHtml(option)}" ${option === shipment.status ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
                    </select>
                    <button class="table-action" type="button" data-status-update="${escapeHtml(trackingNumber)}">Update</button>
                  ` : ''}
                  ${role === 'admin' && !shipment.warehouseId ? '<a class="link" href="./warehouses.html">Assign</a>' : ''}
                </div>
              </td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>
    `;

    mountListControls(container);
  }

  function mountListControls(container) {
    const search = container.querySelector('[data-list-search]');
    const status = container.querySelector('[data-list-status]');
    const rows = [...container.querySelectorAll('[data-list-row]')];

    function applyFilters() {
      const query = (search?.value || '').trim().toLowerCase();
      const statusValue = status?.value || '';
      let visible = 0;

      rows.forEach((row) => {
        const matchesQuery = !query || row.dataset.search?.includes(query);
        const matchesStatus = !statusValue || row.dataset.status === statusValue;
        const show = matchesQuery && matchesStatus;
        row.hidden = !show;
        if (show) visible += 1;
      });

      container.querySelector('[data-list-empty-filter]')?.remove();
      if (!visible) {
        container.insertAdjacentHTML('beforeend', '<div class="empty-state compact" data-list-empty-filter><strong>No matching shipments</strong><span>Try another tracking number, route, or status.</span></div>');
      }
    }

    search?.addEventListener('input', applyFilters);
    status?.addEventListener('change', applyFilters);
  }

  document.addEventListener('click', (event) => {
    const copyButton = event.target.closest('[data-copy]');
    if (copyButton) copyText(copyButton.dataset.copy);

    const statusButton = event.target.closest('[data-status-update]');
    if (statusButton) updateShipmentStatus(statusButton.dataset.statusUpdate);
  });

  async function updateShipmentStatus(trackingNumber) {
    if (!trackingNumber) return;
    const select = [...document.querySelectorAll('[data-status-select]')]
      .find((item) => item.dataset.statusSelect === trackingNumber);
    const status = select?.value;
    if (!status) return;

    try {
      await fetchJson('/api/shipments/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackingNumber, status }),
      });
      showToast('Shipment status updated');
      await Promise.all([loadAdminStats(), loadAdminShipments(), loadAdminAlerts()]);
    } catch (error) {
      showToast(error.message);
    }
  }

  function setupAdminStatusForm() {
    const button = document.getElementById('updateShipmentBtn');
    if (!button) return;

    button.addEventListener('click', async () => {
      const trackingNumber = document.getElementById('updateTracking')?.value?.trim();
      const status = document.getElementById('updateStatus')?.value || 'In Transit';
      const locationTextValue = document.getElementById('updateLocation')?.value?.trim();

      if (!trackingNumber) {
        showToast('Enter tracking number');
        return;
      }

      button.disabled = true;
      try {
        await fetchJson('/api/shipments/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackingNumber,
            status,
            currentLocation: locationTextValue ? { text: locationTextValue } : undefined,
          }),
        });

        document.getElementById('updateTracking').value = '';
        document.getElementById('updateLocation').value = '';
        showToast('Shipment status updated');
        await Promise.all([loadAdminStats(), loadAdminShipments(), loadAdminAlerts()]);
      } catch (error) {
        showToast(error.message);
      } finally {
        button.disabled = false;
      }
    });
  }

  function setupAdminShipmentForm() {
    const button = document.getElementById('createShipmentBtn');
    if (!button) return;

    button.addEventListener('click', async () => {
      const trackingNumber = document.getElementById('createTracking')?.value?.trim();
      const originText = document.getElementById('createOrigin')?.value?.trim();
      const destinationText = document.getElementById('createDestination')?.value?.trim();
      const status = document.getElementById('createStatus')?.value || 'Created';

      if (!originText || !destinationText) {
        showToast('Please fill all required fields');
        return;
      }

      button.disabled = true;
      try {
        await fetchJson('/api/shipments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackingNumber: trackingNumber || `SX-${Date.now()}`,
            origin: { text: originText },
            destination: { text: destinationText },
            status,
          }),
        });

        document.getElementById('createTracking').value = '';
        document.getElementById('createOrigin').value = '';
        document.getElementById('createDestination').value = '';
        showToast('Shipment created successfully');
        await Promise.all([loadAdminStats(), loadAdminShipments(), loadAdminAlerts()]);
      } catch (error) {
        showToast(error.message);
      } finally {
        button.disabled = false;
      }
    });
  }

  async function loadCustomerNotifications() {
    const container = document.getElementById('notifCenter');
    if (!container) return;

    try {
      const data = await fetchJson('/api/notifications');
      const items = data.notifications || data.items || [];
      container.innerHTML = items.length
        ? items.map((item) => `
            <div class="notif-item ${item.type === 'fraud_alert' ? 'alert-danger' : ''}">
              <div class="notif-title">${escapeHtml(item.title || 'Notification')}</div>
              <div class="notif-body">${escapeHtml(item.message || '')}</div>
              ${item.meta?.trackingNumber ? `<div class="notif-meta"><a class="link" href="./tracking.html?tracking=${encodeURIComponent(item.meta.trackingNumber)}">View shipment</a></div>` : ''}
            </div>
          `).join('')
        : '<div class="empty-state compact"><strong>No notifications</strong><span>Shipment updates will appear here.</span></div>';
    } catch (error) {
      container.innerHTML = `<div class="error">${escapeHtml(error.message)}</div>`;
    }
  }

  async function loadCustomerAnalytics() {
    const statOnTime = document.getElementById('statOnTime');
    if (!statOnTime) return;

    try {
      const data = await fetchJson('/api/analytics/customer');
      document.getElementById('statOnTime').textContent = `${data.onTimeRate ?? 0}%`;
      document.getElementById('statAvgEta').textContent = `${data.avgEta ?? 0} days`;
      document.getElementById('statRisk').textContent = `${data.fraudRisk ?? 0}%`;
    } catch (error) {
      showToast(error.message);
    }
  }

  function setupCustomerChatbot() {
    const button = document.getElementById('chatSend');
    const input = document.getElementById('chatInput');
    const messages = document.getElementById('chatMessages');
    if (!button || !input || !messages) return;

    if (!messages.children.length) {
      messages.innerHTML = '<div class="chat-message bot-message">Hi, I can help with tracking, ETA, delays, and shipment questions.</div>';
    }

    async function sendMessage() {
      const message = input.value.trim();
      if (!message) return;

      messages.insertAdjacentHTML('beforeend', `<div class="chat-message user-message">${escapeHtml(message)}</div>`);
      input.value = '';
      messages.scrollTop = messages.scrollHeight;

      try {
        const data = await fetchJson('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        });
        messages.insertAdjacentHTML('beforeend', `<div class="chat-message bot-message">${escapeHtml(data.reply || 'No response from AI')}</div>`);
      } catch (error) {
        messages.insertAdjacentHTML('beforeend', `<div class="chat-message error-message">${escapeHtml(error.message)}</div>`);
      }
      messages.scrollTop = messages.scrollHeight;
    }

    button.addEventListener('click', sendMessage);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') sendMessage();
    });
  }

  function setupCustomerTrackingForm() {
    const form = document.getElementById('customerTrackForm');
    const input = document.getElementById('customerTrackInput');
    if (!form || !input) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const trackingNumber = input.value.trim();
      if (!trackingNumber) return;
      location.href = `./tracking.html?tracking=${encodeURIComponent(trackingNumber)}`;
    });
  }

  function setupSocketUpdates() {
    if (typeof io === 'undefined') return;
    const socket = io(apiBase, {
      auth: { token: getToken() || '' },
      transports: ['websocket', 'polling'],
    });
    const companyId = localStorage.getItem('companyId');
    if (companyId) socket.emit('shipment:subscribe', { companyId });

    socket.on('shipment:update', () => {
      if (currentPage() === 'admin') {
        loadAdminStats();
        loadAdminShipments();
        loadAdminAlerts();
      }
      if (currentPage() === 'customer') {
        loadCustomerShipments();
        loadCustomerNotifications();
        loadCustomerAnalytics();
      }
    });
    socket.on('shipment:created', () => {
      if (currentPage() === 'admin') {
        loadAdminStats();
        loadAdminShipments();
      }
      if (currentPage() === 'customer') loadCustomerShipments();
    });
    socket.on('notification:new', (event = {}) => {
      const notification = event.notification || {};
      if (notification.type === 'fraud_alert') showToast(notification.title || 'Fraud alert received');
      if (currentPage() === 'admin') {
        loadAdminAlerts();
        loadAdminShipments();
      }
      if (currentPage() === 'customer') {
        loadCustomerNotifications();
        loadCustomerAnalytics();
      }
    });
  }

  function init() {
    if (!requireLogin()) return;

    const page = currentPage();
    const admin = isAdminRole();
    if (page === 'admin' && !admin) {
      location.replace('./customer-dashboard.html');
      return;
    }
    if (page === 'customer' && admin) {
      location.replace('./admin-dashboard.html');
      return;
    }

    markActiveNav();
    setupLogout();
    setupSocketUpdates();

    if (page === 'admin') {
      loadAdminIdentity();
      setupIntelligenceActions();
      setupAdminShipmentForm();
      setupAdminStatusForm();
      loadAdminStats();
      loadAdminAlerts();
      loadAdminShipments();
    }

    if (page === 'customer') {
      setupCustomerChatbot();
      setupCustomerTrackingForm();
      loadProfile();
      loadCustomerAnalytics();
      loadCustomerShipments();
      loadCustomerNotifications();
    }

    setInterval(() => {
      if (currentPage() === 'admin') {
        loadAdminStats();
        loadAdminAlerts();
        loadAdminShipments();
      }
      if (currentPage() === 'customer') {
        loadCustomerAnalytics();
        loadCustomerShipments();
        loadCustomerNotifications();
      }
    }, 30000);
  }

  window.__DASHBOARD__ = { authHeaders, loadAdminShipments, loadCustomerShipments };
  document.addEventListener('DOMContentLoaded', init);
})();
