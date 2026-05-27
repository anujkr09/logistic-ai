/*
  Minimal dynamic renderer for shipX UI.
  - Fetches page schema from backend: GET /api/ui/schema/:page (auth protected)
  - Renders simple widgets: summary cards, tables, lists, and basic forms

  This is intentionally small: it keeps all existing page structure working while enabling backend-driven config.
*/

(function () {
  const apiBase = window.__getApiBase?.() || window.API_BASE_URL || 'http://localhost:4000';

  function getToken() {
    return localStorage.getItem('token');
  }

  function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  function el(id) {
    return document.getElementById(id);
  }

  function renderText(targetId, text) {
    const t = el(targetId);
    if (!t) return;
    t.textContent = text ?? '-';
  }

  function renderHtml(targetId, html) {
    const t = el(targetId);
    if (!t) return;
    t.innerHTML = html ?? '';
  }

  async function loadSchema(page) {
    const r = await fetch(`${apiBase}/api/ui/schema/${encodeURIComponent(page)}`, {
      headers: authHeaders(),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || 'Failed to load UI schema');
    return data;
  }

  async function runAction(actionType, payload) {
    const r = await fetch(`${apiBase}/api/ui/action`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ actionType, payload: payload || {} }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || `Action ${actionType} failed`);
    return data;
  }

  function mountTrackingSearch(schema) {
    const formId = schema?.trackingSearch?.formId;
    const field = schema?.trackingSearch?.field;
    const submitAction = schema?.trackingSearch?.submitAction;
    if (!formId || !field || !submitAction) return;

    const form = el(formId);
    const input = el(field.name);
    if (!form || !input) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const trackingNumber = (input.value || '').trim();
      if (!trackingNumber) return;

      // redirect behavior stays in frontend (keeping UI consistent)
      localStorage.setItem('lastTrackingNumber', trackingNumber);
      location.href = './tracking.html';
    }, { once: true });
  }

  function mountBasicSubmitForm(schema) {
    const formId = schema?.form?.id;
    const submitAction = schema?.form?.submitAction;
    if (!formId || !submitAction) return;

    const form = el(formId);
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // collect fields by name
      const fields = schema.form.fields || [];
      const payload = {};
      for (const f of fields) {
        const node = form.elements?.[f.name];
        if (node) payload[f.name] = node.value;
      }

      // auth actions are handled by existing pages' scripts for now.
      // Keep this renderer for future uniformity.
    });
  }

  async function mountAdminDashboard(schema) {
    // Summary cards
    try {
      const summary = await runAction('admin.analytics.summary', {});
      renderText('statTotal', summary.totalShipments);
      renderText('statDelayed', summary.delayedShipments);
      renderText('statDelivered', summary.deliveredShipments);
      renderText('statRevenue', summary.revenue);
    } catch (e) {}

    try {
      const fraud = await runAction('admin.fraud.alerts', {});
      const box = el('fraudAlerts');
      if (box) {
        box.innerHTML = (fraud.alerts || []).map((a) => `
          <div class="notif-item">
            <div class="notif-title">${a.title || 'Fraud alert'}</div>
            <div class="notif-body">${a.reason || ''}</div>
          </div>
        `).join('') || '<div class="muted">No fraud alerts</div>';
      }
    } catch (e) {}

    try {
      const recs = await runAction('admin.ai.recommendations', {});
      const box = el('aiRecs');
      if (box) {
        box.innerHTML = (recs.recommendations || []).map((r) => `
          <div class="notif-item">
            <div class="notif-title">${r.title || 'Recommendation'}</div>
            <div class="notif-body">${r.details || ''}</div>
          </div>
        `).join('') || '<div class="muted">No recommendations</div>';
      }
    } catch (e) {}

    try {
      const items = await runAction('admin.shipments.list', {});
      const box = el('shipmentsAdmin');
      if (box) {
        const list = items.items || [];
        box.innerHTML = `
          <table class="data-table">
            <thead><tr><th>Tracking</th><th>Status</th><th>ETA</th></tr></thead>
            <tbody>
              ${list.map((s) => `
                <tr>
                  <td>${s.trackingNumber}</td>
                  <td>${s.status}</td>
                  <td>${s.estimatedDelivery || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    } catch (e) {}
  }

  async function mountCustomerDashboard(schema) {
    try {
      const analytics = await fetch(`${apiBase}/api/analytics/customer`, { headers: authHeaders() });
      const data = await analytics.json().catch(() => ({}));
      if (analytics.ok) {
        renderText('statOnTime', data.onTimeRate);
        renderText('statAvgEta', data.avgEta);
        renderText('statRisk', data.fraudRisk);
      }
    } catch (e) {}

    try {
      const r = await fetch(`${apiBase}/api/shipments`, { headers: authHeaders() });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        const items = data.items || [];
        const box = el('shipmentsTable');
        if (box) {
          box.innerHTML = `
            <table class="data-table">
              <thead><tr><th>Tracking</th><th>Status</th><th>ETA</th></tr></thead>
              <tbody>
                ${items.map((s) => `
                  <tr>
                    <td>${s.trackingNumber}</td>
                    <td>${s.status}</td>
                    <td>${s.estimatedDelivery || ''}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `;
        }
      }
    } catch (e) {}

    try {
      const n = await fetch(`${apiBase}/api/notifications`, { headers: authHeaders() });
      const data = await n.json().catch(() => ({}));
      if (n.ok) {
        const box = el('notifCenter');
        if (box) {
          const items = data.notifications || data.items || [];
          box.innerHTML = (items || []).map((x) => `
            <div class="notif-item">
              <div class="notif-title">${x.title || 'Notification'}</div>
              <div class="notif-body">${x.message || ''}</div>
            </div>
          `).join('') || '<div class="muted">No notifications</div>';
        }
      }
    } catch (e) {}
  }

  async function mountWarehouses(schema) {
    // Keep using existing /api/warehouses + assign endpoint; dynamic renderer focuses on wiring.
    try {
      const r = await fetch(`${apiBase}/api/warehouses`, { headers: authHeaders() });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || 'Failed');

      const grid = el('warehousesGrid');
      const sel = el('assignWarehouse');

      const list = data.items || data.warehouses || [];

      if (sel) {
        sel.innerHTML = list.map((w) => `<option value="${w._id}">${w.name}</option>`).join('');
      }

      if (grid) {
        grid.innerHTML = (list || []).map((w) => {
          const inventory = w.inventory || {};
          return `
            <div class="warehouse-card">
              <div class="warehouse-top">
                <div>
                  <div class="warehouse-name">${w.name}</div>
                  <div class="muted">${w.city || ''} ${w.country || ''}</div>
                </div>
                <div class="chip">${inventory.used ?? 0}/${inventory.total ?? 'N/A'}</div>
              </div>
              <div class="warehouse-body">
                <div class="warehouse-row"><span class="muted">Inventory</span><b>${inventory.summary || 'Available'}</b></div>
                <div class="warehouse-row"><span class="muted">Location</span><b>${w.address || '-'}</b></div>
              </div>
            </div>
          `;
        }).join('') || '<div class="muted">No warehouses found</div>';
      }
    } catch (e) {}
  }

  function getPageKeyFromPath() {
    const p = (location.pathname || '').toLowerCase();
    if (p.endsWith('login.html')) return 'login';
    if (p.endsWith('register.html')) return 'register';
    if (p.endsWith('tracking.html')) return 'tracking';
    if (p.endsWith('admin-dashboard.html')) return 'adminDashboard';
    if (p.endsWith('customer-dashboard.html')) return 'customerDashboard';
    if (p.endsWith('warehouses.html')) return 'warehouses';
    return null;
  }

  async function initDynamicPage() {
    const pageKey = getPageKeyFromPath();
    if (!pageKey) return;

    // tracking and dashboards require token for schema fetch
    try {
      // If login/register pages are hit, they have their own scripts.
      if (pageKey === 'login' || pageKey === 'register') return;

      const schema = await loadSchema(pageKey);

      if (schema?.trackingSearch) {
        mountTrackingSearch(schema);
      }

      if (schema?.widgets?.includes('summary') && pageKey === 'adminDashboard') {
        await mountAdminDashboard(schema);
      }

      if (pageKey === 'customerDashboard') {
        await mountCustomerDashboard(schema);
      }

      if (pageKey === 'warehouses') {
        await mountWarehouses(schema);
      }
    } catch (e) {
      // silently ignore; existing hardcoded scripts may handle rendering
    }
  }

  window.__SHIPX_DYNAMIC_INIT__ = initDynamicPage;
  document.addEventListener('DOMContentLoaded', initDynamicPage);
})();

