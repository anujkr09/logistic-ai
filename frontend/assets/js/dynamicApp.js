(function () {
  const app = document.getElementById('app');
  const apiBase = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:4000'
    : location.origin;

  const state = {
    user: readJson('user'),
    token: localStorage.getItem('token') || '',
    tracking: null,
  };

  const infoPages = {
    '/shipping-services': ['Shipping Services', 'Create shipments, compare movement options, and keep delivery status visible from one workspace.'],
    '/shipping-tools': ['Shipping Tools', 'Use tracking, pickup planning, AI ETA, warehouse assignment, and notifications together.'],
    '/ship-now': ['Create Shipment', 'Admins can create shipments from the dashboard. Customers can track and review existing deliveries.'],
    '/rates-and-transit-times': ['Rates And Transit Times', 'Plan routes with estimated delivery windows and operational confidence signals.'],
    '/schedule-manage-pickups': ['Pickups', 'Coordinate pickup requests, shipment movement, and warehouse handoff planning.'],
    '/ecommerce': ['Ecommerce Shipping', 'Centralize order movement, tracking visibility, customer notifications, and support context.'],
    '/packaging-shipping-supplies': ['Packaging Guide', 'Prepare parcels with clear labels, accurate addresses, and safe handling details.'],
    '/quote-heavy-shipment': ['Heavy Shipment Quote', 'Plan large shipment movement with route, warehouse, and risk context.'],
    '/contact': ['Contact Support', 'Use tracking context, shipment IDs, and account details to get faster support.'],
  };

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch {
      return null;
    }
  }

  function saveAuth(data) {
    state.token = data.token || '';
    state.user = data.user || null;
    localStorage.setItem('token', state.token);
    localStorage.setItem('user', JSON.stringify(state.user));
    localStorage.setItem('userId', state.user?.id || '');
    localStorage.setItem('userRole', state.user?.role || '');
    localStorage.setItem('companyId', state.user?.companyId || '');
  }

  function clearAuth() {
    state.token = '';
    state.user = null;
    ['token', 'user', 'userId', 'userRole', 'companyId'].forEach((key) => localStorage.removeItem(key));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[char]));
  }

  function initials(name) {
    return String(name || 'U').trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('') || 'U';
  }

  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.style.display = 'block';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      node.style.display = 'none';
    }, 2400);
  }

  function headers(json = false) {
    const h = {};
    if (state.token) h.Authorization = `Bearer ${state.token}`;
    if (json) h['Content-Type'] = 'application/json';
    return h;
  }

  async function api(path, options = {}) {
    const res = await fetch(`${apiBase}${path}`, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `Request failed: ${res.status}`);
    return data;
  }

  function isAdmin() {
    return state.user?.role === 'admin' || state.user?.role === 'warehouse_manager';
  }

  function dashboardPath() {
    return isAdmin() ? '/admin' : '/dashboard';
  }

  function normalizePath() {
    let path = location.pathname.replace(/\/+$/, '') || '/';
    path = path.replace('/app.html', '/').replace('/index.html', '/');
    path = path.replace(/^\/pages\/(.+)\.html$/, '/$1');
    if (path === '/admin-dashboard') return '/admin';
    if (path === '/customer-dashboard') return '/dashboard';
    return path;
  }

  function go(path) {
    const url = new URL(path, location.origin);
    history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
    render();
  }

  function layout(content, activePath = normalizePath()) {
    const signedIn = Boolean(state.token);
    return `
      <div class="app-shell">
        <header class="app-header">
          <div class="app-header-inner">
            <a href="/" class="app-logo" data-link><span>ship</span><strong>X</strong><small>AI</small></a>
            <nav class="app-nav" aria-label="Primary navigation">
              <a href="/tracking" class="${activePath === '/tracking' ? 'active' : ''}" data-link>Tracking</a>
              <a href="/shipping-services" data-link>Shipping</a>
              <a href="/warehouses" class="${activePath === '/warehouses' ? 'active' : ''}" data-link>Warehouses</a>
              <a href="${signedIn ? dashboardPath() : '/login'}" class="${activePath === '/dashboard' || activePath === '/admin' ? 'active' : ''}" data-link>Dashboard</a>
              <a href="/contact" data-link>Support</a>
            </nav>
            <div class="app-user">
              ${signedIn ? `
                <span class="app-avatar">${escapeHtml(initials(state.user?.name))}</span>
                <a href="/profile" data-link>${escapeHtml(state.user?.name || 'Profile')}</a>
                <button type="button" data-action="logout">Logout</button>
              ` : `
                <a href="/login" data-link>Login</a>
                <a class="btn btn-primary" href="/register" data-link>Open account</a>
              `}
            </div>
          </div>
        </header>
        <main class="app-main">${content}</main>
        <footer class="app-footer">shipX AI Logistics dynamic workspace</footer>
      </div>
    `;
  }

  function homePage() {
    return layout(`
      <section class="hero-dynamic">
        <div class="dynamic-panel dynamic-hero-copy">
          <p class="home-kicker">AI logistics for growing teams</p>
          <h1>Ship faster, track cleaner, and manage every delivery from one workspace.</h1>
          <p>Create shipments, monitor route progress, review fraud signals, and keep customer dashboards updated from live backend data.</p>
          <div class="dynamic-actions">
            <a class="btn btn-primary" href="/register" data-link>Open account</a>
            <a class="btn-secondary" href="/tracking" data-link>Track shipment</a>
          </div>
        </div>
        <div class="dynamic-panel route-box">
          <h2>Live shipment preview</h2>
          <div class="route-line"></div>
          <div class="dynamic-grid">
            <div><b>Origin</b><p class="muted-text">Mumbai Hub</p></div>
            <div><b>Status</b><p class="muted-text">In Transit</p></div>
            <div><b>ETA</b><p class="muted-text">AI estimate</p></div>
          </div>
          <a class="btn-secondary" href="/admin" data-link>Open operations</a>
        </div>
      </section>
      <section class="dynamic-grid">
        ${[
          ['Tracking', 'Public shipment lookup with AI route, weather, delay, and ETA context.', '/tracking'],
          ['Dashboards', 'Customer and admin views render from authenticated API data.', state.token ? dashboardPath() : '/login'],
          ['Warehouses', 'Warehouse list and shipment assignment stay connected to backend state.', '/warehouses'],
        ].map(([title, text, href]) => `
          <article class="dynamic-card">
            <h3>${title}</h3>
            <p class="muted-text">${text}</p>
            <a href="${href}" data-link>Open</a>
          </article>
        `).join('')}
      </section>
    `, '/');
  }

  function loginPage() {
    return layout(`
      <section class="dynamic-grid two">
        <div class="dynamic-panel">
          <p class="home-kicker">Secure access</p>
          <h1>Welcome back</h1>
          <p class="muted-text">Login once and the dynamic app loads your profile, dashboard, shipments, and warehouse tools from the API.</p>
        </div>
        <div class="dynamic-panel">
          <h2>Login</h2>
          <form id="loginForm" class="dynamic-form">
            <label class="field"><span>Company</span><input class="input" name="companyName" required placeholder="Company name" /></label>
            <label class="field"><span>Email</span><input class="input" name="email" type="email" required placeholder="you@company.com" /></label>
            <label class="field"><span>Password</span><input class="input" name="password" type="password" required placeholder="Your password" /></label>
            <button class="btn btn-primary" type="submit">Sign in</button>
            <div id="authHint" class="hint"></div>
          </form>
        </div>
      </section>
    `, '/login');
  }

  function registerPage() {
    return layout(`
      <section class="dynamic-grid two">
        <div class="dynamic-panel">
          <p class="home-kicker">Account setup</p>
          <h1>Create your shipX workspace</h1>
          <p class="muted-text">This dynamic form creates company, user, starter warehouses, and token session through the backend.</p>
        </div>
        <div class="dynamic-panel">
          <h2>Open account</h2>
          <form id="registerForm" class="dynamic-form">
            <div class="form-row">
              <label class="field"><span>Name</span><input class="input" name="name" required /></label>
              <label class="field"><span>Email</span><input class="input" name="email" type="email" required /></label>
            </div>
            <div class="form-row">
              <label class="field"><span>Password</span><input class="input" name="password" type="password" required minlength="6" /></label>
              <label class="field"><span>Role</span><select class="select" name="accountRole"><option value="customer">Customer</option><option value="admin">Admin</option></select></label>
            </div>
            <label class="field"><span>Company</span><input class="input" name="companyName" required /></label>
            <div class="form-row">
              <label class="field"><span>PAN</span><input class="input" name="panNumber" required placeholder="ABCDE1234F" /></label>
              <label class="field"><span>GST</span><input class="input" name="gstNumber" required placeholder="07ABCDE1234F1Z5" /></label>
            </div>
            <div class="form-row">
              <label class="field"><span>Country</span><input class="input" name="phoneCountry" required value="India" /></label>
              <label class="field"><span>Code</span><input class="input" name="phoneCountryCode" required value="+91" /></label>
            </div>
            <label class="field"><span>Mobile</span><input class="input" name="phoneNumber" required /></label>
            <button class="btn btn-primary" type="submit">Create account</button>
            <div id="authHint" class="hint"></div>
          </form>
        </div>
      </section>
    `, '/register');
  }

  function requireLogin() {
    if (!state.token) {
      history.replaceState({}, '', '/login');
      return false;
    }
    return true;
  }

  function trackingPage() {
    return layout(`
      <section class="dynamic-panel">
        <h1>Track shipment</h1>
        <form id="trackingForm" class="dynamic-form">
          <div class="form-row">
            <label class="field"><span>Tracking number</span><input id="trackingInput" class="input" required placeholder="SX-DEMO-1001" /></label>
            <label class="field"><span>&nbsp;</span><button class="btn btn-primary" type="submit">Track</button></label>
          </div>
          <div id="trackingHint" class="hint"></div>
        </form>
      </section>
      <section id="trackingResult" class="dynamic-grid two"></section>
    `, '/tracking');
  }

  function renderTrackingResult(shipment) {
    const insights = shipment.aiInsights || {};
    const delay = insights.delay || {};
    const mode = insights.transportMode || {};
    const weather = insights.weather || {};
    const route = insights.routeSummary || `${shipment.origin?.text || '-'} -> ${shipment.destination?.text || '-'}`;
    const target = document.getElementById('trackingResult');
    if (!target) return;
    target.innerHTML = `
      <div class="dynamic-panel">
        <h2>${escapeHtml(shipment.trackingNumber)}</h2>
        <p><span class="status-pill">${escapeHtml(shipment.status || 'Active')}</span></p>
        <table class="data-table">
          <tbody>
            <tr><th>Current location</th><td>${escapeHtml(insights.currentLocationText || shipment.currentLocation?.text || '-')}</td></tr>
            <tr><th>Route</th><td>${escapeHtml(route)}</td></tr>
            <tr><th>Mode</th><td>${escapeHtml(mode.label || 'AI estimating')}</td></tr>
            <tr><th>Weather</th><td>${escapeHtml(weather.label || 'Pending')} ${escapeHtml(weather.temp || '')}</td></tr>
            <tr><th>ETA</th><td>${escapeHtml(insights.estimatedDelivery || shipment.estimatedDelivery || 'Pending')}</td></tr>
            <tr><th>Delay</th><td>${escapeHtml(delay.reason || 'No active delay signal found.')}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="dynamic-panel">
        <h2>AI timeline</h2>
        ${(insights.timeline || shipment.history || []).map((item) => `
          <div class="notif-item">
            <div class="notif-title">${escapeHtml(item.status || 'Update')}</div>
            <div class="notif-body">${escapeHtml(item.detail || item.location?.text || '')}</div>
          </div>
        `).join('') || '<div class="empty-state">No timeline yet.</div>'}
      </div>
    `;
  }

  async function dashboardPage() {
    if (!requireLogin()) return loginPage();
    const data = await api('/api/shipments', { headers: headers() });
    const notes = await api('/api/notifications', { headers: headers() }).catch(() => ({ items: [] }));
    const items = data.items || data.shipments || [];
    return layout(`
      <section class="dynamic-panel">
        <h1>Customer Dashboard</h1>
        <p class="muted-text">Shipment history and notifications loaded dynamically for ${escapeHtml(state.user?.companyName || 'your company')}.</p>
      </section>
      <section class="dynamic-grid">
        <div class="dynamic-card"><h3>Total</h3><p class="stat-value">${items.length}</p></div>
        <div class="dynamic-card"><h3>Delivered</h3><p class="stat-value">${items.filter((x) => x.status === 'Delivered').length}</p></div>
        <div class="dynamic-card"><h3>Alerts</h3><p class="stat-value">${(notes.items || notes.notifications || []).length}</p></div>
      </section>
      <section class="dynamic-panel">
        <h2>My shipments</h2>
        ${shipmentTable(items)}
      </section>
    `, '/dashboard');
  }

  async function adminPage() {
    if (!requireLogin()) return loginPage();
    if (!isAdmin()) return layout('<div class="dynamic-panel"><h1>Admin access required</h1><p class="muted-text">Login with an admin account to use operations tools.</p></div>', '/admin');
    const data = await api('/api/shipments/admin', { headers: headers() });
    const items = data.items || data.shipments || [];
    return layout(`
      <section class="dynamic-panel">
        <h1>Admin Dashboard</h1>
        <p class="muted-text">Create shipments, update status, monitor delays, and manage operational data from backend APIs.</p>
      </section>
      <section class="dynamic-grid">
        <div class="dynamic-card"><h3>Total</h3><p class="stat-value">${data.totalShipments || data.total || 0}</p></div>
        <div class="dynamic-card"><h3>Delayed</h3><p class="stat-value">${data.delayedShipments || data.delayed || 0}</p></div>
        <div class="dynamic-card"><h3>Delivered</h3><p class="stat-value">${data.deliveredShipments || data.delivered || 0}</p></div>
      </section>
      <section class="dynamic-grid two">
        <div class="dynamic-panel">
          <h2>Create shipment</h2>
          <form id="createShipmentForm" class="dynamic-form">
            <input class="input" name="trackingNumber" placeholder="SX-123456" />
            <input class="input" name="origin" required placeholder="Origin" />
            <input class="input" name="destination" required placeholder="Destination" />
            <select class="select" name="status"><option>Created</option><option>In Transit</option><option>Arrived</option><option>Out for Delivery</option><option>Delivered</option></select>
            <button class="btn btn-primary" type="submit">Create</button>
            <div class="hint" id="createHint"></div>
          </form>
        </div>
        <div class="dynamic-panel">
          <h2>Update status</h2>
          <form id="updateShipmentForm" class="dynamic-form">
            <input class="input" name="trackingNumber" required placeholder="Tracking number" />
            <input class="input" name="currentLocation" placeholder="Current location" />
            <select class="select" name="status"><option>Created</option><option>In Transit</option><option>Arrived</option><option>Out for Delivery</option><option>Delivered</option><option>Delayed</option></select>
            <button class="btn btn-primary" type="submit">Update</button>
            <div class="hint" id="updateHint"></div>
          </form>
        </div>
      </section>
      <section class="dynamic-panel"><h2>Shipments</h2>${shipmentTable(items)}</section>
    `, '/admin');
  }

  function shipmentTable(items) {
    if (!items.length) return '<div class="empty-state">No shipments found.</div>';
    return `
      <div class="table-responsive">
        <table class="data-table">
          <thead><tr><th>Tracking</th><th>Status</th><th>Origin</th><th>Destination</th><th>ETA</th></tr></thead>
          <tbody>
            ${items.map((s) => `
              <tr>
                <td><a href="/tracking?tracking=${encodeURIComponent(s.trackingNumber)}" data-link>${escapeHtml(s.trackingNumber)}</a></td>
                <td>${escapeHtml(s.status)}</td>
                <td>${escapeHtml(s.origin?.text || '')}</td>
                <td>${escapeHtml(s.destination?.text || '')}</td>
                <td>${escapeHtml(s.estimatedDelivery || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function warehousesPage() {
    if (!requireLogin()) return loginPage();
    const data = await api('/api/warehouses', { headers: headers() });
    const items = data.items || data.warehouses || [];
    return layout(`
      <section class="dynamic-panel">
        <h1>Warehouses</h1>
        <p class="muted-text">Warehouse inventory and location cards are loaded from your company workspace.</p>
      </section>
      <section class="dynamic-grid">
        ${items.map((w) => `
          <article class="dynamic-card">
            <h3>${escapeHtml(w.name)}</h3>
            <p class="muted-text">${escapeHtml([w.city, w.country].filter(Boolean).join(', ') || w.address || '')}</p>
            <p><b>${escapeHtml(w.inventory?.used ?? 0)}</b> / ${escapeHtml(w.inventory?.total ?? 'N/A')} used</p>
          </article>
        `).join('') || '<div class="empty-state">No warehouses found.</div>'}
      </section>
    `, '/warehouses');
  }

  async function profilePage() {
    if (!requireLogin()) return loginPage();
    const data = await api('/api/auth/me', { headers: headers() }).catch(() => ({ user: state.user }));
    state.user = data.user || state.user;
    localStorage.setItem('user', JSON.stringify(state.user));
    return layout(`
      <section class="dynamic-panel">
        <h1>Profile</h1>
        <table class="data-table">
          <tbody>
            <tr><th>Name</th><td>${escapeHtml(state.user?.name)}</td></tr>
            <tr><th>Email</th><td>${escapeHtml(state.user?.email)}</td></tr>
            <tr><th>Company</th><td>${escapeHtml(state.user?.companyName)}</td></tr>
            <tr><th>Role</th><td>${escapeHtml(state.user?.role)}</td></tr>
            <tr><th>PAN</th><td>${escapeHtml(state.user?.panNumber)}</td></tr>
            <tr><th>GST</th><td>${escapeHtml(state.user?.gstNumber)}</td></tr>
          </tbody>
        </table>
      </section>
    `, '/profile');
  }

  function infoPage(path) {
    const page = infoPages[path] || ['Page', 'This dynamic page is ready to connect to backend managed content.'];
    return layout(`
      <section class="dynamic-panel">
        <p class="home-kicker">shipX workspace</p>
        <h1>${escapeHtml(page[0])}</h1>
        <p class="muted-text">${escapeHtml(page[1])}</p>
        <div class="dynamic-actions">
          <a class="btn btn-primary" href="/tracking" data-link>Track shipment</a>
          <a class="btn-secondary" href="${state.token ? dashboardPath() : '/login'}" data-link>Open dashboard</a>
        </div>
      </section>
    `, path);
  }

  async function render() {
    const path = normalizePath();
    document.title = 'shipX AI Logistics';
    try {
      if (path === '/') app.innerHTML = homePage();
      else if (path === '/login') app.innerHTML = loginPage();
      else if (path === '/register') app.innerHTML = registerPage();
      else if (path === '/tracking') app.innerHTML = trackingPage();
      else if (path === '/dashboard') app.innerHTML = await dashboardPage();
      else if (path === '/admin') app.innerHTML = await adminPage();
      else if (path === '/warehouses') app.innerHTML = await warehousesPage();
      else if (path === '/profile') app.innerHTML = await profilePage();
      else app.innerHTML = infoPage(path);
      bindPage();
    } catch (error) {
      app.innerHTML = layout(`<div class="dynamic-panel"><h1>Something needs attention</h1><p class="muted-text">${escapeHtml(error.message)}</p></div>`, path);
      bindPage();
    }
  }

  function bindPage() {
    document.querySelectorAll('[data-link]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('http')) return;
        event.preventDefault();
        go(href);
      });
    });

    document.querySelector('[data-action="logout"]')?.addEventListener('click', () => {
      clearAuth();
      toast('Logged out');
      go('/');
    });

    document.getElementById('loginForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const hint = document.getElementById('authHint');
      if (hint) hint.textContent = 'Signing in...';
      try {
        const data = await api('/api/auth/login', {
          method: 'POST',
          headers: headers(true),
          body: JSON.stringify(Object.fromEntries(new FormData(form))),
        });
        saveAuth(data);
        toast('Login successful');
        go(dashboardPath());
      } catch (error) {
        if (hint) hint.textContent = error.message;
      }
    });

    document.getElementById('registerForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = Object.fromEntries(new FormData(form));
      payload.panNumber = String(payload.panNumber || '').toUpperCase();
      payload.gstNumber = String(payload.gstNumber || '').toUpperCase();
      const hint = document.getElementById('authHint');
      if (hint) hint.textContent = 'Creating account...';
      try {
        const data = await api('/api/auth/register', {
          method: 'POST',
          headers: headers(true),
          body: JSON.stringify(payload),
        });
        saveAuth(data);
        toast('Account created');
        go(dashboardPath());
      } catch (error) {
        if (hint) hint.textContent = error.message;
      }
    });

    document.getElementById('trackingForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const input = document.getElementById('trackingInput');
      const hint = document.getElementById('trackingHint');
      const tracking = input?.value?.trim() || new URLSearchParams(location.search).get('tracking');
      if (!tracking) return;
      if (hint) hint.textContent = 'Loading tracking...';
      try {
        const data = await api(`/api/shipments/track/${encodeURIComponent(tracking)}`);
        state.tracking = data;
        renderTrackingResult(data);
        if (hint) hint.textContent = '';
      } catch (error) {
        if (hint) hint.textContent = error.message;
      }
    });

    const queryTracking = new URLSearchParams(location.search).get('tracking');
    if (queryTracking && document.getElementById('trackingInput')) {
      document.getElementById('trackingInput').value = queryTracking;
      document.getElementById('trackingForm').dispatchEvent(new Event('submit'));
    }

    document.getElementById('createShipmentForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const values = Object.fromEntries(new FormData(form));
      const hint = document.getElementById('createHint');
      try {
        await api('/api/shipments', {
          method: 'POST',
          headers: headers(true),
          body: JSON.stringify({
            trackingNumber: values.trackingNumber,
            origin: { text: values.origin },
            destination: { text: values.destination },
            status: values.status,
          }),
        });
        toast('Shipment created');
        go('/admin');
      } catch (error) {
        if (hint) hint.textContent = error.message;
      }
    });

    document.getElementById('updateShipmentForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const hint = document.getElementById('updateHint');
      try {
        await api('/api/shipments/status', {
          method: 'PATCH',
          headers: headers(true),
          body: JSON.stringify({
            trackingNumber: values.trackingNumber,
            status: values.status,
            currentLocation: values.currentLocation ? { text: values.currentLocation } : undefined,
          }),
        });
        toast('Shipment updated');
        go('/admin');
      } catch (error) {
        if (hint) hint.textContent = error.message;
      }
    });
  }

  window.addEventListener('popstate', render);
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    });
  }
  render();
})();
