/*
  Analytics page helper

  Currently used by customer-dashboard.html and admin-dashboard.html.
  Those pages already contain inline loading logic, but this file provides:
  - a reusable set of functions (optional)
  - a safe fallback if inline scripts are removed later
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

  async function loadCustomerAnalytics({ onSuccess } = {}) {
    const r = await fetch(`${apiBase}/api/analytics/customer`, { headers: authHeaders() });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || 'Failed to load customer analytics');
    onSuccess?.(data);
    return data;
  }

  async function loadAdminSummary({ onSuccess } = {}) {
    const r = await fetch(`${apiBase}/api/analytics/admin/summary`, { headers: authHeaders() });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || 'Failed to load admin summary');
    onSuccess?.(data);
    return data;
  }

  // Auto-fill customer dashboard if placeholders exist and inline script isn't doing it.
  async function autoMount() {
    const statOnTime = document.getElementById('statOnTime');
    const statAvgEta = document.getElementById('statAvgEta');
    const statRisk = document.getElementById('statRisk');

    // If page doesn't look like customer dashboard, don't touch.
    if (!statOnTime || !statAvgEta || !statRisk) return;

    // Don't overwrite if already filled by inline script.
    const anyFilled = [statOnTime, statAvgEta, statRisk].some((x) => (x.textContent || '').trim() !== '-');
    if (anyFilled) return;

    try {
      const token = getToken();
      if (!token) return;
      const data = await loadCustomerAnalytics({});
      statOnTime.textContent = data.onTimeRate ?? '-';
      statAvgEta.textContent = data.avgEta ?? '-';
      statRisk.textContent = data.fraudRisk ?? '-';
    } catch (e) {
      // silent
    }
  }

  window.__SHIPX_ANALYTICS__ = {
    loadCustomerAnalytics,
    loadAdminSummary,
  };

  document.addEventListener('DOMContentLoaded', autoMount);
})();

