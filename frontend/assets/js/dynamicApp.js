(function () {
  const app = document.getElementById('app');
  const storeKey = 'zyraviqWorkspace.v2';
  const apiBase = window.API_BASE_URL
    ? String(window.API_BASE_URL).replace(/\/$/, '')
    : (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://localhost:4000'
      : location.origin);

  window.API_BASE_URL = apiBase;
  window.__getApiBase = () => apiBase;

  const entityConfig = {
    users: { title: 'Users', singular: 'User', fields: ['name', 'email', 'role', 'status'], filter: 'role', lead: 'Manage workspace access, account roles, and active user status.' },
    orders: { title: 'Orders', singular: 'Order', fields: ['orderNo', 'customer', 'status', 'total'], filter: 'status', lead: 'Review order movement from intake to shipment handoff.' },
    products: { title: 'Products', singular: 'Product', fields: ['name', 'sku', 'stock', 'status'], filter: 'status', lead: 'Maintain shipping supplies, SKU availability, and fulfillment readiness.' },
    shipments: { title: 'Shipments', singular: 'Shipment', fields: ['trackingNumber', 'origin', 'destination', 'status'], filter: 'status', lead: 'Create shipment records, update routes, and open tracking details.' },
    routes: { title: 'Plan Route', singular: 'Route Plan', fields: ['routeNo', 'origin', 'destination', 'service'], filter: 'service', lead: 'Compare ETA, service type, and movement options before booking.' },
    pickups: { title: 'Pickup Desk', singular: 'Pickup', fields: ['pickupNo', 'address', 'slot', 'status'], filter: 'status', lead: 'Book, edit, and monitor pickup slots with address and assignment context.' },
    stores: { title: 'Store Shipping', singular: 'Store Order', fields: ['store', 'orderNo', 'channel', 'status'], filter: 'status', lead: 'Move ecommerce orders from channel intake to packing and dispatch.' },
    warehouses: { title: 'Warehouses', singular: 'Warehouse', fields: ['name', 'city', 'capacity', 'status'], filter: 'status', lead: 'Track hub capacity, city coverage, and operational readiness.' },
    payments: { title: 'Payments', singular: 'Payment', fields: ['invoiceNo', 'customer', 'amount', 'status'], filter: 'status', lead: 'Review invoices, payment states, and customer billing status.' },
    support: { title: 'Support', singular: 'Ticket', fields: ['ticketNo', 'subject', 'status', 'priority'], filter: 'status', lead: 'Resolve delivery help, callbacks, account issues, and support escalations.' },
    packaging: { title: 'Packaging Guide', singular: 'Packaging Item', fields: ['item', 'packageType', 'handling', 'status'], filter: 'status', lead: 'Prepare parcels with package type, handling notes, and readiness checks.' },
    freight: { title: 'Heavy Freight', singular: 'Freight Quote', fields: ['quoteNo', 'cargo', 'weight', 'status'], filter: 'status', lead: 'Plan oversized cargo, weight handling, and freight quote progress.' },
    notifications: { title: 'Notifications', singular: 'Notification', fields: ['title', 'message', 'type', 'status'], filter: 'type', lead: 'Manage alerts, shipment updates, payment notices, and read state.' },
  };

  const routeAliases = {
    '/admin-dashboard': '/admin',
    '/alerts': '/notifications',
    '/create-user-id': '/register',
    '/customer-dashboard': '/dashboard',
    '/home': '/',
    '/ship-now': '/shipments',
    '/shipping': '/shipping',
    '/tracking': '/tracking',
    '/shipping-services': '/shipments',
    '/shipping-tools': '/analytics',
    '/rates-and-transit-times': '/routes',
    '/schedule-manage-pickups': '/pickups',
    '/ecommerce': '/stores',
    '/packaging-shipping-supplies': '/packaging',
    '/quote-heavy-shipment': '/freight',
    '/contact': '/support',
    '/zyraviq-one-stop-shop': '/dashboard',
  };

  const state = {
    user: readJson('user'),
    token: localStorage.getItem('token') || '',
    db: readDb(),
    backendReady: false,
  };

  function defaultDb() {
    return {
      users: [
        { id: 'usr-1', name: 'Admin User', email: 'admin@zyraviq.test', role: 'admin', status: 'Active' },
        { id: 'usr-2', name: 'Customer User', email: 'customer@zyraviq.test', role: 'customer', status: 'Active' },
      ],
      orders: [
        { id: 'ord-1', orderNo: 'ORD-1001', customer: 'Northstar Retail', status: 'Processing', total: '2450' },
        { id: 'ord-2', orderNo: 'ORD-1002', customer: 'Bluecart', status: 'Shipped', total: '890' },
      ],
      products: [
        { id: 'prd-1', name: 'Fragile package kit', sku: 'PKG-FRG-01', stock: '140', status: 'Available' },
        { id: 'prd-2', name: 'Thermal label roll', sku: 'LBL-TH-22', stock: '42', status: 'Low stock' },
      ],
      routes: [
        { id: 'rte-1', routeNo: 'RTE-DEL-BLR', origin: 'Delhi', destination: 'Bengaluru', service: 'Express' },
        { id: 'rte-2', routeNo: 'RTE-MUM-PUN', origin: 'Mumbai', destination: 'Pune', service: 'Economy' },
      ],
      pickups: [
        { id: 'pku-1', pickupNo: 'PU-501', address: 'Andheri East Warehouse', slot: 'Today 4 PM - 6 PM', status: 'Booked' },
        { id: 'pku-2', pickupNo: 'PU-502', address: 'Koramangala Store', slot: 'Tomorrow 10 AM - 12 PM', status: 'Assigned' },
      ],
      stores: [
        { id: 'sto-1', store: 'Northstar Shopify', orderNo: 'WEB-7781', channel: 'Shopify', status: 'Ready to ship' },
        { id: 'sto-2', store: 'Bluecart Marketplace', orderNo: 'MKT-2042', channel: 'Marketplace', status: 'Packed' },
      ],
      shipments: [
        {
          id: 'shp-1',
          trackingNumber: 'ZQ-DEMO-1001',
          origin: 'Mumbai Hub',
          destination: 'Delhi Customer',
          status: 'In Transit',
          currentLocation: 'Jaipur Linehaul',
          eta: tomorrow(2),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'shp-2',
          trackingNumber: 'ZQ-DEMO-1002',
          origin: 'Bengaluru Hub',
          destination: 'Chennai Doorstep',
          status: 'Delivered',
          currentLocation: 'Delivered',
          eta: tomorrow(-1),
          updatedAt: new Date().toISOString(),
        },
      ],
      warehouses: [
        { id: 'wh-1', name: 'Mumbai Central Hub', city: 'Mumbai', capacity: '78%', status: 'Active' },
        { id: 'wh-2', name: 'Delhi North Hub', city: 'Delhi', capacity: '61%', status: 'Active' },
      ],
      payments: [
        { id: 'pay-1', invoiceNo: 'INV-9001', customer: 'Northstar Retail', amount: '2450', status: 'Paid' },
        { id: 'pay-2', invoiceNo: 'INV-9002', customer: 'Bluecart', amount: '890', status: 'Pending' },
      ],
      support: [
        { id: 'sup-1', ticketNo: 'SUP-3001', subject: 'Address correction request', status: 'Open', priority: 'High' },
        { id: 'sup-2', ticketNo: 'SUP-3002', subject: 'Pickup slot change', status: 'Resolved', priority: 'Medium' },
      ],
      packaging: [
        { id: 'pkg-1', item: 'Fragile glassware', packageType: 'Double wall box', handling: 'Cushion and label fragile', status: 'Ready' },
        { id: 'pkg-2', item: 'Cold-chain parcel', packageType: 'Insulated mailer', handling: 'Temperature controlled', status: 'Needs review' },
      ],
      freight: [
        { id: 'frt-1', quoteNo: 'FRT-7001', cargo: 'Machinery pallet', weight: '850 kg', status: 'Quoted' },
        { id: 'frt-2', quoteNo: 'FRT-7002', cargo: 'Oversized retail fixtures', weight: '420 kg', status: 'Reviewing' },
      ],
      notifications: [
        { id: 'not-1', title: 'Shipment moved', message: 'ZQ-DEMO-1001 crossed Jaipur hub.', type: 'Shipment', status: 'Unread' },
        { id: 'not-2', title: 'Payment received', message: 'Invoice INV-9001 was marked paid.', type: 'Payment', status: 'Read' },
      ],
      settings: {
        companyName: 'ZYRAVIQ Demo Workspace',
        emailAlerts: true,
        smsAlerts: true,
        defaultCurrency: 'INR',
      },
    };
  }

  function tomorrow(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  }

  function readDb() {
    try {
      const stored = JSON.parse(localStorage.getItem(storeKey) || 'null');
      return stored ? { ...defaultDb(), ...stored } : defaultDb();
    } catch {
      return defaultDb();
    }
  }

  function persist() {
    localStorage.setItem(storeKey, JSON.stringify(state.db));
  }

  function workspaceSession() {
    let key = localStorage.getItem('zyraviqWorkspaceSession');
    if (!key) {
      key = `zyraviq-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem('zyraviqWorkspaceSession', key);
    }
    return key;
  }

  function apiHeaders(json = false) {
    const headers = { 'X-Workspace-Session': workspaceSession() };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    if (json) headers['Content-Type'] = 'application/json';
    return headers;
  }

  async function workspaceApi(entity, options = {}) {
    const response = await fetch(`${apiBase}/api/workspace/${entity}${options.id ? `/${encodeURIComponent(options.id)}` : ''}`, {
      method: options.method || 'GET',
      headers: apiHeaders(Boolean(options.body)),
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Workspace API failed');
    state.backendReady = true;
    return data;
  }

  async function loadWorkspaceFromMongo() {
    const entities = Object.keys(entityConfig);
    const results = await Promise.allSettled(entities.map((entity) => workspaceApi(entity).then((data) => [entity, data.items || []])));
    let loaded = false;
    results.forEach((result) => {
      if (result.status !== 'fulfilled') return;
      const [entity, items] = result.value;
      if (Array.isArray(items) && items.length) {
        state.db[entity] = items;
        loaded = true;
      }
    });
    if (loaded) persist();
    return loaded;
  }

  async function saveWorkspaceItem(entity, record) {
    try {
      const data = await workspaceApi(entity, {
        id: record.id,
        method: record.id ? 'PUT' : 'POST',
        body: { data: record },
      });
      return data.item || record;
    } catch (error) {
      state.backendReady = false;
      toast('MongoDB save failed, saved locally', 'error');
      return record;
    }
  }

  async function deleteWorkspaceItem(entity, id) {
    try {
      await workspaceApi(entity, { id, method: 'DELETE' });
    } catch (error) {
      state.backendReady = false;
      toast('MongoDB delete failed, removed locally', 'error');
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
    }[char]));
  }

  function titleCase(value) {
    return String(value || '').replace(/[-_]/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase());
  }

  function normalizePath() {
    let path = location.pathname.replace(/\/+$/, '') || '/';
    path = path.replace('/app.html', '/').replace('/index.html', '/');
    path = path.replace(/^\/pages\/(.+)\.html$/, '/$1');
    path = path.replace(/^\/(.+)\.html$/, '/$1');
    return routeAliases[path] || path;
  }

  function go(path) {
    const url = new URL(path, location.origin);
    history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`);
    render();
  }

  function toast(message, tone = 'success') {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
    node.style.display = 'block';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { node.style.display = 'none'; }, 2600);
  }

  function signedIn() {
    return Boolean(state.token || state.user);
  }

  function isAdmin() {
    return state.user?.role === 'admin' || state.user?.role === 'warehouse_manager';
  }

  function isMockToken() {
    return !state.token || String(state.token).startsWith('mock-');
  }

  function saveAuth(user) {
    state.token = `mock-${Date.now()}`;
    state.user = user;
    localStorage.setItem('token', state.token);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('userRole', user.role || 'customer');
    localStorage.setItem('companyId', 'local-company');
  }

  function clearAuth() {
    state.token = '';
    state.user = null;
    ['token', 'user', 'userRole', 'userId', 'companyId'].forEach((key) => localStorage.removeItem(key));
  }

  function layout(content, activePath = normalizePath(), crumbs = []) {
    const active = routeAliases[activePath] || activePath;
    const nav = [
      ['Dashboard', signedIn() && isAdmin() ? '/admin' : '/dashboard'],
      ['Shipments', '/shipments'],
      ['Tracking', '/tracking'],
      ['Orders', '/orders'],
      ['Products', '/products'],
      ['Pickups', '/pickups'],
      ['Warehouses', '/warehouses'],
      ...(isAdmin() ? [['Users', '/users']] : []),
      ['Payments', '/payments'],
      ['Analytics', '/analytics'],
      ['Data Center', '/data-center'],
      ['Reports', '/reports'],
      ['Support', '/support'],
      ['Settings', '/settings'],
    ];
    return `
      <div class="app-shell">
        <a class="skip-link" href="#app-main">Skip to content</a>
        <header class="app-header">
          <div class="app-header-inner">
            <a href="/" class="app-logo"><span>ZYRAVIQ</span><small>AI</small></a>
            <nav class="app-nav" aria-label="Primary navigation">
              ${nav.map(([label, href]) => `<a href="${href}" class="${active === href ? 'active' : ''}" data-link>${label}</a>`).join('')}
            </nav>
            <div class="app-user">
              ${signedIn() ? `
                <a class="app-profile-link" href="/profile" data-link><span class="app-avatar">${escapeHtml(initials(state.user?.name))}</span><span>${escapeHtml(state.user?.name || 'Profile')}</span></a>
                <button type="button" data-action="logout">Logout</button>
              ` : `
                <a href="/login" data-link>Login</a>
                <a class="btn btn-primary" href="/register" data-link>Open account</a>
              `}
            </div>
          </div>
        </header>
        ${desktopSideNav(active)}
        <main id="app-main" class="app-main">
          ${breadcrumbs(crumbs.length ? crumbs : [['Home', '/'], [pageTitle(active), active]])}
          ${content}
        </main>
        ${bottomNav(active)}
      </div>
      <dialog id="confirmDialog" class="confirm-dialog">
        <form method="dialog">
          <h2 id="confirmTitle">Confirm action</h2>
          <p id="confirmMessage">Are you sure?</p>
          <div class="dynamic-actions">
            <button class="btn-secondary" value="cancel">Cancel</button>
            <button class="btn btn-primary" value="ok">Confirm</button>
          </div>
        </form>
      </dialog>
    `;
  }

  function bottomNav(activePath = normalizePath()) {
    const items = [
      ['Home', '/', 'home', 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5z'],
      ['Shipping', '/shipping', 'shipping', 'M4 7h16v10H4z M7 7V5h10v2 M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
      ['Tracking', '/tracking', 'tracking', 'M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
      ['Shipments', '/shipments', 'shipments', 'M4 7l8-4 8 4-8 4-8-4z M4 7v10l8 4 8-4V7 M12 11v10'],
      ['More', '/more', 'more', 'M5 5h5v5H5z M14 5h5v5h-5z M5 14h5v5H5z M14 14h5v5h-5z'],
    ];
    const normalized = activePath === '/orders' ? '/shipments' : activePath;
    return `<nav class="mobile-bottom-nav" aria-label="Mobile bottom navigation">
      ${items.map(([label, href, key, pathData]) => {
        const isActive = href === '/'
          ? normalized === '/'
          : normalized === href || normalized.startsWith(`${href}/`) || (href === '/shipping' && ['/routes', '/pickups', '/stores', '/packaging', '/freight'].includes(normalized));
        return `<a class="mobile-bottom-nav__item ${isActive ? 'active' : ''}" href="${href}" ${href === '/' ? '' : 'data-link'} aria-label="${label}" ${isActive ? 'aria-current="page"' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${pathData}"></path></svg>
          <span>${label}</span>
        </a>`;
      }).join('')}
    </nav>`;
  }

  function desktopSideNav(activePath = normalizePath()) {
    const items = [
      ['Home', '/', 'home', 'M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5z'],
      ['Shipping', '/shipping', 'shipping', 'M4 7h16v10H4z M7 7V5h10v2 M7 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4z M17 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4z'],
      ['Tracking', '/tracking', 'tracking', 'M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
      ['Shipments', '/shipments', 'shipments', 'M4 7l8-4 8 4-8 4-8-4z M4 7v10l8 4 8-4V7 M12 11v10'],
      ['More', '/more', 'more', 'M5 5h5v5H5z M14 5h5v5h-5z M5 14h5v5H5z M14 14h5v5h-5z'],
    ];
    const normalized = activePath === '/orders' ? '/shipments' : activePath;
    return `<nav class="desktop-side-nav" aria-label="Desktop side navigation">
      ${items.map(([label, href, key, pathData]) => {
        const isActive = href === '/'
          ? normalized === '/'
          : normalized === href || normalized.startsWith(`${href}/`) || (href === '/shipping' && ['/routes', '/pickups', '/stores', '/packaging', '/freight'].includes(normalized));
        return `<a class="desktop-side-nav__item ${isActive ? 'active' : ''}" href="${href}" ${href === '/' ? '' : 'data-link'} aria-label="${label}" ${isActive ? 'aria-current="page"' : ''}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${pathData}"></path></svg>
          <span>${label}</span>
        </a>`;
      }).join('')}
    </nav>`;
  }

  function initials(name) {
    return String(name || 'U').trim().split(/\s+/).slice(0, 2).map((x) => x[0]?.toUpperCase()).join('') || 'U';
  }

  function pageTitle(path) {
    const key = Object.keys(entityConfig).find((name) => path === `/${name}`);
    if (key) return entityConfig[key].title;
    if (path === '/') return 'Home';
    return titleCase(path.replace(/^\//, '') || 'Page');
  }

  function breadcrumbs(items) {
    return '';
  }

  function homePage() {
    const cards = [
      ['Shipments', 'Create, edit, delete, track, download, and print shipments.', '/shipments'],
      ['Orders', 'Manage ecommerce and pickup orders with status filters.', '/orders'],
      ['Products', 'Maintain shipping supplies and product inventory.', '/products'],
      ['Analytics', 'Review delivery, revenue, fraud, and SLA metrics.', '/analytics'],
      ['Data Center', 'See orders, deliveries, tracking, issues, payments, invoices, and export data.', '/data-center'],
      ['Support', 'Open and resolve delivery or account tickets.', '/support'],
      ['Settings', 'Control profile, notifications, and workspace preferences.', '/settings'],
    ];
    return layout(`
      <section class="hero-dynamic">
        <div class="dynamic-panel dynamic-hero-copy">
          <p class="home-kicker">AI logistics operations</p>
          <h1>One working place for every visible ZYRAVIQ action.</h1>
          <p>Every card and navigation item opens a useful page with persisted local data, validation, search, filters, sorting, details, add, edit, delete, download, and print actions.</p>
          <div class="dynamic-actions">
            <a class="btn btn-primary" href="/shipments?action=add" data-link>Create shipment</a>
            <a class="btn-secondary" href="/tracking" data-link>Track shipment</a>
          </div>
        </div>
        <div class="dynamic-panel route-box">
          <h2>Operations Snapshot</h2>
          <div class="route-line"></div>
          <div class="dynamic-grid">
            <div><b>${state.db.shipments.length}</b><p class="muted-text">Shipments</p></div>
            <div><b>${state.db.orders.length}</b><p class="muted-text">Orders</p></div>
            <div><b>${state.db.support.filter((x) => x.status !== 'Resolved').length}</b><p class="muted-text">Open tickets</p></div>
          </div>
          <button class="btn-secondary snapshot-print-button" type="button" data-action="print">Print snapshot</button>
        </div>
      </section>
      <section class="dynamic-grid">
        ${cards.map(([title, text, href]) => `
          <article class="dynamic-card actionable-card" tabindex="0" data-card-href="${href}">
            <h3>${title}</h3>
            <p class="muted-text">${text}</p>
            <a href="${href}" data-link>Open ${title}</a>
          </article>`).join('')}
      </section>
    `, '/', [['Home', '/']]);
  }

  function shippingPage() {
    const cards = [
      ['Create shipment', 'Start a parcel or freight order with origin, destination, and status.', '/shipments?action=add'],
      ['Plan route', 'Compare ETA and service options before dispatch.', '/routes'],
      ['Pickup desk', 'Book, edit, and monitor pickup slots.', '/pickups'],
      ['Store shipping', 'Move ecommerce orders into fulfillment.', '/stores'],
      ['Packaging guide', 'Prepare parcels with handling and package readiness.', '/packaging'],
      ['Heavy freight', 'Request and manage oversized shipment quotes.', '/freight'],
    ];
    return layout(`
      <section class="dynamic-panel">
        <p class="home-kicker">Shipping workspace</p>
        <h1>Shipping</h1>
        <p class="muted-text">Create shipments, plan routes, schedule pickups, manage store orders, prepare packaging, and handle freight from one mobile-friendly page.</p>
      </section>
      <section class="dynamic-grid">
        ${cards.map(([title, text, href]) => `<article class="dynamic-card actionable-card" tabindex="0" data-card-href="${href}">
          <h3>${title}</h3>
          <p class="muted-text">${text}</p>
          <a href="${href}" data-link>Open</a>
        </article>`).join('')}
      </section>
    `, '/shipping', [['Home', '/'], ['Shipping', '/shipping']]);
  }

  function loginPage() {
    return layout(`
      <section class="dynamic-grid two">
        <div class="dynamic-panel">
          <p class="home-kicker">Secure access</p>
          <h1>Login</h1>
          <p class="muted-text">Use any valid email. Choose admin role for operations pages or customer role for customer-only views.</p>
        </div>
        <div class="dynamic-panel">
          <form id="loginForm" class="dynamic-form">
            <label class="field"><span>Email</span><input class="input" name="email" type="email" autocomplete="email" inputmode="email" required /></label>
            <label class="field"><span>Password</span><input class="input" name="password" type="password" autocomplete="current-password" required minlength="4" /></label>
            <label class="field"><span>Role</span><select class="select" name="role"><option value="admin">Admin</option><option value="customer">Customer</option></select></label>
            <button class="btn btn-primary" type="submit">Login</button>
            <div id="authHint" class="hint" role="alert"></div>
          </form>
        </div>
      </section>
    `, '/login');
  }

  function registerPage() {
    return layout(`
      <section class="dynamic-grid two">
        <div class="dynamic-panel">
          <p class="home-kicker">Open account</p>
          <h1>Create workspace user</h1>
          <p class="muted-text">The account is saved locally so refreshes keep the session and data available.</p>
        </div>
        <div class="dynamic-panel">
          <form id="registerForm" class="dynamic-form" data-dirty-form>
            <div class="form-row">
              <label class="field"><span>Name</span><input class="input" name="name" required /></label>
              <label class="field"><span>Email</span><input class="input" name="email" type="email" required /></label>
            </div>
            <label class="field"><span>Password</span><input class="input" name="password" type="password" required minlength="6" /></label>
            <label class="field"><span>Role</span><select class="select" name="role"><option value="customer">Customer</option><option value="admin">Admin</option></select></label>
            <div class="dynamic-actions">
              <button class="btn btn-primary" type="submit">Submit</button>
              <button class="btn-secondary" type="button" data-action="cancel-form">Cancel</button>
            </div>
            <div id="authHint" class="hint" role="alert"></div>
          </form>
        </div>
      </section>
    `, '/register');
  }

  function requireLogin() {
    if (signedIn()) return true;
    go('/login');
    toast('Please login first', 'error');
    return false;
  }

  function dashboardPage(admin = false) {
    if (!requireLogin()) return '';
    if (admin && !isAdmin()) {
      go('/dashboard');
      toast('Admin console is admin-only', 'error');
      return '';
    }
    const totals = {
      shipments: state.db.shipments.length,
      orders: state.db.orders.length,
      delivered: state.db.shipments.filter((x) => x.status === 'Delivered').length,
      alerts: state.db.notifications.filter((x) => x.status === 'Unread').length,
    };
    return layout(`
      <section class="dynamic-panel">
        <p class="home-kicker">${admin ? 'Admin console' : 'Customer dashboard'}</p>
        <h1>${admin ? 'Admin Dashboard' : 'Dashboard'}</h1>
        <p class="muted-text">Live local workspace summary with quick actions connected to real pages.</p>
      </section>
      <section class="dynamic-grid">
        ${Object.entries(totals).map(([label, value]) => `<button class="dynamic-card stat-button" type="button" data-card-href="/${label === 'delivered' ? 'shipments?filter=Delivered' : label === 'alerts' ? 'notifications' : label}">
          <h3>${titleCase(label)}</h3><p class="stat-value">${value}</p>
        </button>`).join('')}
      </section>
      <section class="dynamic-grid two">
        <div class="dynamic-panel"><h2>Recent shipments</h2>${smallList('shipments', state.db.shipments.slice(0, 5))}</div>
        <div class="dynamic-panel"><h2>Notifications</h2>${smallList('notifications', state.db.notifications.slice(0, 5))}</div>
      </section>
    `, admin ? '/admin' : '/dashboard');
  }

  function smallList(entity, rows) {
    if (!rows.length) return '<div class="empty-state">No records available.</div>';
    const cfg = entityConfig[entity];
    return rows.map((row) => `<div class="list-item">
      <div><strong>${escapeHtml(row[cfg.fields[0]] || row.title || row.id)}</strong><p class="muted-text">${escapeHtml(row[cfg.fields[1]] || row.message || '')}</p></div>
      <a href="/${entity}/${encodeURIComponent(row.id)}" data-link>View</a>
    </div>`).join('');
  }

  function entityPage(entity) {
    if (!requireLogin()) return '';
    const cfg = entityConfig[entity];
    if (!cfg) return notFoundPage();
    if (entity === 'users' && !isAdmin()) {
      go('/dashboard');
      toast('Users management is admin-only', 'error');
      return '';
    }
    const params = new URLSearchParams(location.search);
    const filter = params.get('filter') || '';
    const rows = [...(state.db[entity] || [])];
    const options = [...new Set(rows.map((x) => x[cfg.filter]).filter(Boolean))];
    return layout(`
      <section class="dynamic-panel">
        <div class="page-head-row">
          <div>
            <p class="home-kicker">${cfg.singular} management</p>
            <h1>${cfg.title}</h1>
            <p class="muted-text">${escapeHtml(cfg.lead)} Search, filter, sort, add, view, edit, delete, download, and print records.</p>
          </div>
          <div class="dynamic-actions">
            <button class="btn btn-primary" type="button" data-entity="${entity}" data-action="add">Add ${cfg.singular}</button>
            <button class="btn-secondary" type="button" data-entity="${entity}" data-action="download">Download</button>
            <button class="btn-secondary" type="button" data-action="print">Print</button>
          </div>
        </div>
      </section>
      <section class="dynamic-panel">
        <div class="list-toolbar">
          <input class="input" type="search" data-table-search placeholder="Search ${cfg.title.toLowerCase()}" aria-label="Search ${cfg.title}" />
          <select class="select" data-table-filter aria-label="Filter ${cfg.title}">
            <option value="">All ${cfg.filter}s</option>
            ${options.map((value) => `<option value="${escapeHtml(value)}" ${value === filter ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}
          </select>
          <select class="select" data-table-sort aria-label="Sort ${cfg.title}">
            ${cfg.fields.map((field) => `<option value="${field}">Sort by ${titleCase(field)}</option>`).join('')}
          </select>
        </div>
        <div class="table-responsive">${entityTable(entity, rows)}</div>
      </section>
      ${featureWorkflow(entity)}
      ${entityForm(entity)}
    `, `/${entity}`, [['Home', '/'], [cfg.title, `/${entity}`]]);
  }

  function featureWorkflow(entity) {
    const workflows = {
      shipments: ['Add route and recipient details', 'Open tracking or update status', 'Download or print shipment data'],
      routes: ['Enter origin and destination', 'Select service option', 'Use the route plan while creating shipment'],
      pickups: ['Book a pickup slot', 'Edit assignment or timing', 'Monitor pickup status until collected'],
      stores: ['Capture store order', 'Mark packing and channel status', 'Move order into shipment creation'],
      support: ['Create ticket with issue details', 'Prioritize delivery help', 'Resolve and keep history'],
      packaging: ['Choose package type', 'Add handling instructions', 'Mark parcel ready for movement'],
      freight: ['Add cargo and weight', 'Review quote status', 'Coordinate support follow-up'],
      notifications: ['Review alert type', 'Mark read or update status', 'Open related workflow'],
    };
    const steps = workflows[entity];
    if (!steps) return '';
    return `<section class="dynamic-panel feature-workflow">
      <div>
        <p class="home-kicker">Workflow</p>
        <h2>How ${escapeHtml(entityConfig[entity].title)} works</h2>
      </div>
      <ol>
        ${steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
      </ol>
    </section>`;
  }

  function entityTable(entity, rows) {
    const cfg = entityConfig[entity];
    if (!rows.length) return '<div class="empty-state">No records available.</div>';
    return `<table class="data-table" data-entity-table="${entity}">
      <thead><tr>${cfg.fields.map((field) => `<th>${titleCase(field)}</th>`).join('')}<th>Actions</th></tr></thead>
      <tbody>
        ${rows.map((row) => rowTemplate(entity, row)).join('')}
      </tbody>
    </table><div class="empty-state compact" data-filter-empty hidden>No data found.</div>`;
  }

  function rowTemplate(entity, row) {
    const cfg = entityConfig[entity];
    const search = cfg.fields.map((field) => row[field]).join(' ').toLowerCase();
    return `<tr data-row-id="${escapeHtml(row.id)}" data-filter="${escapeHtml(row[cfg.filter] || '')}" data-search="${escapeHtml(search)}">
      ${cfg.fields.map((field) => `<td>${escapeHtml(row[field])}</td>`).join('')}
      <td>
        <div class="table-actions">
          <a class="link" href="/${entity}/${encodeURIComponent(row.id)}" data-link>View</a>
          <button class="table-action" type="button" data-entity="${entity}" data-id="${escapeHtml(row.id)}" data-action="edit">Edit</button>
          <button class="table-action danger" type="button" data-entity="${entity}" data-id="${escapeHtml(row.id)}" data-action="delete">Delete</button>
        </div>
      </td>
    </tr>`;
  }

  function entityForm(entity) {
    const cfg = entityConfig[entity];
    return `<dialog id="entityDialog" class="entity-dialog">
      <form id="entityForm" class="dynamic-form" data-dirty-form>
        <h2 id="entityDialogTitle">Add ${escapeHtml(cfg.singular)}</h2>
        <input type="hidden" name="id" />
        ${cfg.fields.map((field) => `<label class="field"><span>${titleCase(field)}</span><input class="input" name="${field}" required /></label>`).join('')}
        <div class="dynamic-actions">
          <button class="btn btn-primary" type="submit">Save</button>
          <button class="btn-secondary" type="button" data-action="close-dialog">Cancel</button>
        </div>
        <div class="hint" id="formError" role="alert"></div>
      </form>
    </dialog>`;
  }

  function detailPage(entity, id) {
    if (!requireLogin()) return '';
    const cfg = entityConfig[entity];
    if (entity === 'users' && !isAdmin()) {
      go('/dashboard');
      toast('Users management is admin-only', 'error');
      return '';
    }
    const item = state.db[entity]?.find((row) => row.id === id);
    if (!cfg || !item) return notFoundPage('Data missing');
    return layout(`
      <section class="dynamic-panel">
        <div class="page-head-row">
          <div>
            <p class="home-kicker">${cfg.singular} details</p>
            <h1>${escapeHtml(item[cfg.fields[0]] || item.title || item.id)}</h1>
            <p class="muted-text">Detail view with working edit, delete, print, and back actions.</p>
          </div>
          <div class="dynamic-actions">
            <button class="btn-secondary" type="button" data-action="back">Back</button>
            <button class="btn btn-primary" type="button" data-entity="${entity}" data-id="${escapeHtml(id)}" data-action="edit">Edit</button>
            <button class="btn-secondary danger" type="button" data-entity="${entity}" data-id="${escapeHtml(id)}" data-action="delete">Delete</button>
            <button class="btn-secondary" type="button" data-action="print">Print</button>
          </div>
        </div>
      </section>
      <section class="dynamic-panel">
        <table class="data-table"><tbody>
          ${Object.entries(item).map(([key, value]) => `<tr><th>${titleCase(key)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}
        </tbody></table>
      </section>
      ${entityForm(entity)}
    `, `/${entity}`, [['Home', '/'], [cfg.title, `/${entity}`], ['Details', `/${entity}/${id}`]]);
  }

  function trackingPage() {
    return layout(`
      <section class="dynamic-panel">
        <p class="home-kicker">Live tracking</p>
        <h1>Tracking</h1>
        <form id="trackingForm" class="dynamic-form">
          <div class="form-row">
            <label class="field"><span>Tracking number</span><input id="trackingInput" class="input" required placeholder="ZQ-DEMO-1001" /></label>
            <label class="field"><span>&nbsp;</span><button class="btn btn-primary" type="submit">Track</button></label>
          </div>
          <div id="trackingHint" class="hint" role="alert"></div>
        </form>
      </section>
      <section id="trackingResult" class="dynamic-grid two"></section>
    `, '/tracking');
  }

  function renderTracking(trackingNumber) {
    const result = document.getElementById('trackingResult');
    const hint = document.getElementById('trackingHint');
    if (!result) return;
    const shipment = state.db.shipments.find((x) => x.trackingNumber.toLowerCase() === String(trackingNumber).toLowerCase());
    if (!shipment) {
      result.innerHTML = '<div class="empty-state">No data found for this tracking number.</div>';
      if (hint) hint.textContent = 'Tracking number not found.';
      return;
    }
    if (hint) hint.textContent = '';
    const createdAt = trackingDate(shipment.createdAt || shipment.updatedAt);
    const eta = trackingDate(shipment.eta || shipment.estimatedDelivery || shipment.updatedAt || shipment.createdAt);
    const updatedAt = trackingDate(shipment.updatedAt || shipment.createdAt);
    const weather = trackingWeather(shipment);
    const issue = shipmentIssue(shipment, state.db.support || []);
    result.innerHTML = `
      <div class="dynamic-panel tracking-detail-panel"><h2>${escapeHtml(shipment.trackingNumber)}</h2><p><span class="status-pill">${escapeHtml(shipment.status)}</span></p>
        <table class="data-table tracking-detail-table"><tbody>
          <tr><th>Created</th><td>${escapeHtml(createdAt)}</td></tr>
          <tr><th>Last update</th><td>${escapeHtml(updatedAt)}</td></tr>
          <tr><th>Origin</th><td>${escapeHtml(shipment.origin)}</td></tr>
          <tr><th>Destination</th><td>${escapeHtml(shipment.destination)}</td></tr>
          <tr><th>Current location</th><td>${escapeHtml(shipment.currentLocation || shipment.origin)}</td></tr>
          <tr><th>ETA / time</th><td>${escapeHtml(eta)}</td></tr>
          <tr><th>Weather</th><td>${escapeHtml(weather.label)} - ${escapeHtml(weather.detail)}</td></tr>
          <tr><th>Issue</th><td>${escapeHtml(issue)}</td></tr>
        </tbody></table></div>
      <div class="dynamic-panel tracking-map-panel">
        <h2>Route map</h2>
        ${trackingMapPreview(shipment, weather)}
      </div>
      <div class="dynamic-panel"><h2>Actions</h2><div class="dynamic-actions">
        <a class="btn btn-primary" href="/shipments/${encodeURIComponent(shipment.id)}" data-link>View shipment</a>
        <button class="btn-secondary" type="button" data-action="print">Print</button>
        <button class="btn-secondary" type="button" data-entity="shipments" data-action="download">Download</button>
      </div></div>`;
  }

  function trackingDate(value) {
    if (!value) return 'Not available';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  function trackingWeather(shipment = {}) {
    const routeText = `${shipment.origin || ''} ${shipment.destination || ''} ${shipment.currentLocation || ''}`;
    const warm = /delhi|jaipur|bhopal|mumbai/i.test(routeText);
    const rainy = /chennai|bengaluru|kolkata|kochi/i.test(routeText);
    if (rainy) return { label: 'Rain watch', detail: 'Light rain may affect scan timing near the route.' };
    if (warm) return { label: 'Clear and warm', detail: 'No severe weather alert on this route.' };
    return { label: 'Operational', detail: 'Weather is suitable for normal movement.' };
  }

  function trackingMapPreview(shipment = {}, weather = trackingWeather(shipment)) {
    const origin = shipment.origin || 'Origin';
    const current = shipment.currentLocation || shipment.origin || 'Current';
    const destination = shipment.destination || 'Destination';
    const status = shipment.status || 'Tracking';
    const mode = trackingMode(shipment);
    const progress = trackingProgress(shipment);
    const map = trackingMapEmbed(origin, current, destination, weather, mode, progress);
    return `
      <div class="tracking-route-preview" aria-label="Route from ${escapeHtml(origin)} to ${escapeHtml(destination)}">
        ${map || `
          <div class="tracking-route-preview__map route-overlay-surface">
            <span class="route-pin route-pin--origin">A</span>
            <span class="route-pin route-pin--current">${escapeHtml(mode.icon)}</span>
            <span class="route-pin route-pin--destination">B</span>
            <span class="route-path"></span>
            <span class="route-path-progress" style="width:${progress}%"></span>
          </div>
        `}
        <div class="tracking-route-preview__grid">
          <div><span>From</span><strong>${escapeHtml(origin)}</strong></div>
          <div><span>Current</span><strong>${escapeHtml(current)}</strong></div>
          <div><span>To</span><strong>${escapeHtml(destination)}</strong></div>
          <div><span>Status</span><strong>${escapeHtml(status)}</strong></div>
          <div><span>Mode</span><strong>${escapeHtml(mode.icon)} ${escapeHtml(mode.label)}</strong></div>
          <div><span>Weather</span><strong>${escapeHtml(weather.label)}</strong></div>
          <div><span>ETA</span><strong>${escapeHtml(trackingDate(shipment.eta || shipment.estimatedDelivery || shipment.updatedAt || shipment.createdAt))}</strong></div>
        </div>
      </div>
    `;
  }

  function trackingMapEmbed(origin, current, destination, weather = {}, mode = trackingMode(), progress = 35) {
    const originPoint = cityPoint(origin);
    const currentPoint = cityPoint(current) || originPoint;
    const destinationPoint = cityPoint(destination);
    if (!originPoint || !destinationPoint) return '';
    const [originPos, currentPos, destinationPos] = projectRoutePoints([originPoint, currentPoint, destinationPoint]);
    const linePoints = `${originPos.x},${originPos.y} ${currentPos.x},${currentPos.y} ${destinationPos.x},${destinationPos.y}`;
    const progressLinePoints = `${originPos.x},${originPos.y} ${currentPos.x},${currentPos.y}`;
    return `
      <div class="tracking-map-embed">
        <div class="tracking-map-canvas" role="img" aria-label="Shipment route from ${escapeHtml(origin)} to ${escapeHtml(destination)}">
          <div class="tracking-map-grid" aria-hidden="true"></div>
          <span class="tracking-map-region tracking-map-region--north">NORTH</span>
          <span class="tracking-map-region tracking-map-region--west">WEST</span>
          <span class="tracking-map-region tracking-map-region--south">SOUTH</span>
          <svg class="tracking-map-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline class="tracking-map-route-shadow" points="${linePoints}"></polyline>
            <polyline class="tracking-map-route-base" points="${linePoints}"></polyline>
            <polyline class="tracking-map-route-progress" points="${progressLinePoints}"></polyline>
          </svg>
          <span class="map-city map-city--origin" style="left:${originPos.x}%;top:${originPos.y}%"><b>A</b><span>${escapeHtml(origin)}</span></span>
          <span class="map-city map-city--current" style="left:${currentPos.x}%;top:${currentPos.y}%"><b>${escapeHtml(mode.icon)}</b><span>${escapeHtml(current)}</span></span>
          <span class="map-city map-city--destination" style="left:${destinationPos.x}%;top:${destinationPos.y}%"><b>B</b><span>${escapeHtml(destination)}</span></span>
        </div>
        <div class="route-overlay route-overlay--map" aria-hidden="true">
          <div class="route-line-track">
            <span class="route-line-fill" style="width:${progress}%"></span>
          </div>
          <span class="route-stop route-stop--origin">A</span>
          <span class="route-vehicle" style="left:${progress}%">${escapeHtml(mode.icon)}</span>
          <span class="route-stop route-stop--destination">B</span>
        </div>
        <div class="tracking-map-badges">
          <div class="tracking-map-weather">
            <span>Weather</span>
            <strong>${escapeHtml(weather.label || 'Operational')}</strong>
            <small>${escapeHtml(weather.detail || 'Weather is suitable for movement.')}</small>
          </div>
          <div class="tracking-map-mode">
            <span>Transport</span>
            <strong>${escapeHtml(mode.icon)} ${escapeHtml(mode.label)}</strong>
            <small>${escapeHtml(mode.detail)}</small>
          </div>
        </div>
        <div class="tracking-map-legend">
          <span><b>A</b>${escapeHtml(origin)}</span>
          <span><b>Now</b>${escapeHtml(current)}</span>
          <span><b>B</b>${escapeHtml(destination)}</span>
        </div>
      </div>
    `;
  }

  function trackingMode(shipment = {}) {
    const text = `${shipment.service || ''} ${shipment.mode || ''} ${shipment.transportMode || ''} ${shipment.status || ''} ${shipment.origin || ''} ${shipment.destination || ''}`.toLowerCase();
    if (/air|plane|flight|express/.test(text)) return { icon: 'AIR', label: 'Plane', detail: 'Fast air movement for long distance delivery.' };
    if (/rail|train/.test(text)) return { icon: 'RAIL', label: 'Train', detail: 'Rail linehaul between major hubs.' };
    if (/bike|local|courier|last mile|out for delivery/.test(text)) return { icon: 'BIKE', label: 'Bike', detail: 'Local last-mile movement.' };
    return { icon: 'TRK', label: 'Truck', detail: 'Road linehaul and hub movement.' };
  }

  function trackingProgress(shipment = {}) {
    const status = String(shipment.status || '').toLowerCase();
    if (status.includes('deliver')) return 100;
    if (status.includes('out for delivery')) return 82;
    if (status.includes('arrived')) return 68;
    if (status.includes('transit')) return 52;
    if (status.includes('created')) return 18;
    return 35;
  }

  function maxDiff(values) {
    return Math.max(...values) - Math.min(...values);
  }

  function projectRoutePoints(points) {
    const lats = points.map((point) => point.lat);
    const lons = points.map((point) => point.lon);
    const latSpan = Math.max(maxDiff(lats), 0.5);
    const lonSpan = Math.max(maxDiff(lons), 0.5);
    const minLat = Math.min(...lats) - latSpan * 0.25;
    const maxLat = Math.max(...lats) + latSpan * 0.25;
    const minLon = Math.min(...lons) - lonSpan * 0.25;
    const maxLon = Math.max(...lons) + lonSpan * 0.25;
    return points.map((point) => ({
      x: clamp(8 + ((point.lon - minLon) / (maxLon - minLon)) * 84, 8, 92).toFixed(2),
      y: clamp(12 + (1 - ((point.lat - minLat) / (maxLat - minLat))) * 76, 12, 88).toFixed(2),
    }));
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function cityPoint(value) {
    const text = String(value || '').toLowerCase();
    if (!text.trim()) return null;
    const points = [
      ['delhi', 28.6139, 77.2090],
      ['new delhi', 28.6139, 77.2090],
      ['bhopal', 23.2599, 77.4126],
      ['mumbai', 19.0760, 72.8777],
      ['bengaluru', 12.9716, 77.5946],
      ['bangalore', 12.9716, 77.5946],
      ['chennai', 13.0827, 80.2707],
      ['kolkata', 22.5726, 88.3639],
      ['hyderabad', 17.3850, 78.4867],
      ['pune', 18.5204, 73.8567],
      ['jaipur', 26.9124, 75.7873],
      ['ahmedabad', 23.0225, 72.5714],
      ['lucknow', 26.8467, 80.9462],
      ['indore', 22.7196, 75.8577],
      ['surat', 21.1702, 72.8311],
      ['nagpur', 21.1458, 79.0882],
      ['noida', 28.5355, 77.3910],
      ['gurgaon', 28.4595, 77.0266],
      ['gurugram', 28.4595, 77.0266],
    ];
    const match = points.find(([name]) => text.includes(name));
    if (match) return { lat: match[1], lon: match[2] };

    const seed = text.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return {
      lat: 8 + (seed % 2600) / 100,
      lon: 68 + ((seed * 7) % 2800) / 100,
    };
  }

  function analyticsPage() {
    if (!requireLogin()) return '';
    const delivered = state.db.shipments.filter((x) => x.status === 'Delivered').length;
    const onTime = state.db.shipments.length ? Math.round((delivered / state.db.shipments.length) * 100) : 0;
    return layout(`
      <section class="dynamic-panel"><p class="home-kicker">Analytics</p><h1>Analytics</h1><p class="muted-text">Operational metrics calculated from current persisted data.</p></section>
      <section class="dynamic-grid">
        <div class="dynamic-card"><h3>On-time rate</h3><p class="stat-value">${onTime}%</p></div>
        <div class="dynamic-card"><h3>Revenue</h3><p class="stat-value">${sumAmounts(state.db.payments)}</p></div>
        <div class="dynamic-card"><h3>Open support</h3><p class="stat-value">${state.db.support.filter((x) => x.status !== 'Resolved').length}</p></div>
      </section>
      <section class="dynamic-panel"><h2>Actions</h2><div class="dynamic-actions"><a class="btn btn-primary" href="/reports" data-link>View reports</a><button class="btn-secondary" type="button" data-action="print">Print</button></div></section>
    `, '/analytics');
  }

  function reportsPage() {
    if (!requireLogin()) return '';
    return layout(`
      <section class="dynamic-panel"><p class="home-kicker">Reports</p><h1>Reports</h1><p class="muted-text">Download or print operational report snapshots.</p></section>
      <section class="dynamic-grid">
        ${['Shipment report', 'Payment report', 'Support report'].map((title) => `<article class="dynamic-card"><h3>${title}</h3><p class="muted-text">Generated from local workspace data.</p><div class="dynamic-actions"><button class="btn-secondary" data-report="${title}" data-action="download-report" type="button">Download</button><button class="btn-secondary" data-action="print" type="button">Print</button></div></article>`).join('')}
      </section>
    `, '/reports');
  }

  function dataCenterPage() {
    if (!requireLogin()) return '';
    const report = buildDataCenterReport();
    const scopeLabel = isAdmin() ? 'Admin full workspace' : 'Customer account';
    return layout(`
      <section class="dynamic-panel">
        <div class="page-head-row">
          <div>
            <p class="home-kicker">${scopeLabel}</p>
            <h1>Data Center</h1>
            <p class="muted-text">Orders, delivered counts, tracking movement, route origin and destination, issues, payment invoices, and customer activity in one exportable place.</p>
          </div>
          <div class="dynamic-actions">
            <button class="btn btn-primary" type="button" data-action="download-data-center">Export data</button>
            <button class="btn-secondary" type="button" data-action="print">Print</button>
          </div>
        </div>
      </section>
      <section class="dynamic-grid data-center-stats">
        ${report.stats.map(([label, value]) => `<article class="dynamic-card"><h3>${escapeHtml(label)}</h3><p class="stat-value">${escapeHtml(value)}</p></article>`).join('')}
      </section>
      <section class="dynamic-panel">
        <h2>Tracking and delivery movement</h2>
        <div class="table-responsive">${reportTable(['Tracking no.', 'From', 'To', 'Current', 'Status', 'ETA / time', 'Issue'], report.shipments)}</div>
      </section>
      <section class="dynamic-panel">
        <h2>Orders taken and delivered</h2>
        <div class="table-responsive">${reportTable(['Order no.', 'Customer', 'Status', 'Amount', 'Payment', 'Invoice'], report.orders)}</div>
      </section>
      <section class="dynamic-panel">
        <h2>Payments and invoices</h2>
        <div class="table-responsive">${reportTable(['Invoice', 'Customer', 'Amount', 'Status', 'Payment date', 'Linked order'], report.payments)}</div>
      </section>
      <section class="dynamic-panel">
        <h2>Issues and support</h2>
        <div class="table-responsive">${reportTable(['Ticket', 'Subject', 'Priority', 'Status', 'Related data'], report.issues)}</div>
      </section>
    `, '/data-center', [['Home', '/'], ['Data Center', '/data-center']]);
  }

  function customerMatches(row) {
    if (isAdmin()) return true;
    const user = state.user || {};
    const haystack = [
      row.customer,
      row.email,
      row.customerEmail,
      row.name,
      row.companyName,
      row.store,
    ].filter(Boolean).join(' ').toLowerCase();
    const needles = [user.email, user.name, user.companyName].filter(Boolean).map((value) => String(value).toLowerCase());
    return !haystack || needles.some((needle) => haystack.includes(needle));
  }

  function buildDataCenterReport() {
    const orders = (state.db.orders || []).filter(customerMatches);
    const shipments = (state.db.shipments || []).filter(customerMatches);
    const payments = (state.db.payments || []).filter(customerMatches);
    const issues = (state.db.support || []).filter(customerMatches);
    const delivered = shipments.filter((row) => String(row.status).toLowerCase() === 'delivered').length;
    const openIssues = issues.filter((row) => String(row.status).toLowerCase() !== 'resolved').length;
    const paid = payments.filter((row) => String(row.status).toLowerCase() === 'paid').length;
    const totalPayment = payments.reduce((sum, row) => sum + Number(row.amount || 0), 0).toLocaleString();

    return {
      stats: [
        ['Orders', orders.length],
        ['Delivered', delivered],
        ['In transit', shipments.filter((row) => String(row.status).toLowerCase().includes('transit')).length],
        ['Open issues', openIssues],
        ['Paid invoices', paid],
        ['Payment total', totalPayment],
      ],
      shipments: shipments.map((row) => [
        row.trackingNumber || row.id,
        row.origin || '-',
        row.destination || '-',
        row.currentLocation || row.origin || '-',
        row.status || '-',
        row.eta || row.estimatedDelivery || row.updatedAt || '-',
        shipmentIssue(row, issues),
      ]),
      orders: orders.map((row, index) => {
        const payment = payments[index % Math.max(payments.length, 1)] || {};
        return [
          row.orderNo || row.id,
          row.customer || state.user?.name || '-',
          row.status || '-',
          row.total || row.amount || payment.amount || '-',
          payment.status || 'Pending',
          payment.invoiceNo || `INV-${row.orderNo || row.id}`,
        ];
      }),
      payments: payments.map((row, index) => [
        row.invoiceNo || `INV-${index + 1}`,
        row.customer || state.user?.name || '-',
        row.amount || '-',
        row.status || '-',
        row.updatedAt || row.createdAt || '-',
        orders[index % Math.max(orders.length, 1)]?.orderNo || '-',
      ]),
      issues: issues.map((row) => [
        row.ticketNo || row.id,
        row.subject || row.message || '-',
        row.priority || '-',
        row.status || '-',
        row.relatedData || row.customer || '-',
      ]),
      raw: { orders, shipments, payments, issues },
    };
  }

  function shipmentIssue(shipment, issues) {
    if (shipment.fraud?.isFlagged) return 'Fraud flagged';
    const related = issues.find((issue) => {
      const text = `${issue.subject || ''} ${issue.message || ''} ${issue.ticketNo || ''}`.toLowerCase();
      return text.includes(String(shipment.trackingNumber || shipment.id || '').toLowerCase());
    });
    if (related) return related.subject || related.status || 'Support issue';
    return String(shipment.status).toLowerCase() === 'delivered' ? 'No issue' : 'Monitoring';
  }

  function reportTable(headers, rows) {
    if (!rows.length) return '<div class="empty-state">No data available for this account.</div>';
    return `<table class="data-table data-center-table">
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(formatReportCell(cell))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
  }

  function formatReportCell(value) {
    if (!value) return '-';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
    }
    return value;
  }

  function settingsPage() {
    if (!requireLogin()) return '';
    const s = state.db.settings;
    return layout(`
      <section class="dynamic-panel"><p class="home-kicker">Settings</p><h1>Settings</h1><p class="muted-text">Save profile, notification, and workspace preferences.</p></section>
      <section class="dynamic-panel">
        <form id="settingsForm" class="dynamic-form" data-dirty-form>
          <label class="field"><span>Company name</span><input class="input" name="companyName" required value="${escapeHtml(s.companyName)}" /></label>
          <label class="field"><span>Default currency</span><select class="select" name="defaultCurrency"><option ${s.defaultCurrency === 'INR' ? 'selected' : ''}>INR</option><option ${s.defaultCurrency === 'USD' ? 'selected' : ''}>USD</option></select></label>
          <label class="check-row"><input type="checkbox" name="emailAlerts" ${s.emailAlerts ? 'checked' : ''} /> Email alerts</label>
          <label class="check-row"><input type="checkbox" name="smsAlerts" ${s.smsAlerts ? 'checked' : ''} /> SMS alerts</label>
          <div class="dynamic-actions"><button class="btn btn-primary" type="submit">Save</button><button class="btn-secondary" type="button" data-action="cancel-form">Cancel</button></div>
          <div class="hint" id="settingsHint" role="alert"></div>
        </form>
      </section>
    `, '/settings');
  }

  function profilePage() {
    if (!requireLogin()) return '';
    const phone = state.user?.phone || {};
    const companyName = state.user?.companyName || state.db.settings.companyName || '';
    const role = state.user?.role || 'customer';
    return layout(`
      <section class="dynamic-panel">
        <p class="home-kicker">${escapeHtml(titleCase(role))} profile</p>
        <h1>Profile</h1>
        <p class="muted-text">Account, contact, PAN/GST, and company details for the signed-in user.</p>
      </section>
      <section class="dynamic-panel">
        <form id="profileForm" class="dynamic-form" data-dirty-form>
          <div class="form-row">
            <label class="field"><span>Name</span><input class="input" name="name" required value="${escapeHtml(state.user?.name || '')}" /></label>
            <label class="field"><span>Email</span><input class="input" name="email" type="email" required value="${escapeHtml(state.user?.email || '')}" /></label>
          </div>
          <div class="form-row">
            <label class="field"><span>Company</span><input class="input" name="companyName" required value="${escapeHtml(companyName)}" /></label>
            <label class="field"><span>Role</span><input class="input" name="roleLabel" readonly value="${escapeHtml(titleCase(role))}" /></label>
          </div>
          <div class="form-row">
            <label class="field"><span>PAN number</span><input class="input" name="panNumber" maxlength="10" required value="${escapeHtml(state.user?.panNumber || '')}" /></label>
            <label class="field"><span>GST number</span><input class="input" name="gstNumber" maxlength="15" required value="${escapeHtml(state.user?.gstNumber || '')}" /></label>
          </div>
          <div class="form-row">
            <label class="field"><span>Country</span><input class="input" name="phoneCountry" required value="${escapeHtml(phone.country || 'India')}" /></label>
            <label class="field"><span>Country code</span><input class="input" name="phoneCountryCode" required value="${escapeHtml(phone.countryCode || '+91')}" /></label>
          </div>
          <label class="field"><span>Mobile number</span><input class="input" name="phoneNumber" type="tel" inputmode="tel" required value="${escapeHtml(phone.number || '')}" /></label>
          <div class="dynamic-actions"><button class="btn btn-primary" type="submit">Save</button><button class="btn-secondary" type="button" data-action="cancel-form">Cancel</button></div>
          <div class="hint" id="profileHint" role="alert"></div>
        </form>
      </section>
      <section class="dynamic-panel">
        <div class="table-responsive">
          <table class="data-table"><tbody>
            <tr><th>Name</th><td>${escapeHtml(state.user?.name || '-')}</td></tr>
            <tr><th>Email</th><td>${escapeHtml(state.user?.email || '-')}</td></tr>
            <tr><th>Mobile</th><td>${escapeHtml([phone.countryCode, phone.number].filter(Boolean).join(' ') || '-')}</td></tr>
            <tr><th>Company</th><td>${escapeHtml(companyName || '-')}</td></tr>
            <tr><th>PAN</th><td>${escapeHtml(state.user?.panNumber || '-')}</td></tr>
            <tr><th>GST</th><td>${escapeHtml(state.user?.gstNumber || '-')}</td></tr>
            <tr><th>Account type</th><td>${escapeHtml(titleCase(role))}</td></tr>
            <tr><th>User ID</th><td>${escapeHtml(state.user?.id || '-')}</td></tr>
            <tr><th>Company ID</th><td>${escapeHtml(state.user?.companyId || localStorage.getItem('companyId') || '-')}</td></tr>
            <tr><th>Status</th><td>${escapeHtml(state.user?.status || 'active')}</td></tr>
          </tbody></table>
        </div>
      </section>
    `, '/profile');
  }

  function morePage() {
    const items = [
      ['Profile', 'Manage account details and role.', '/profile'],
      ['Settings', 'Update alerts and workspace preferences.', '/settings'],
      ['Data Center', 'Orders, deliveries, tracking movement, issues, payments, invoices, and export.', '/data-center'],
      ['Reports', 'Download and print operational reports.', '/reports'],
      ['Support', 'Create tickets and delivery help requests.', '/support?action=add'],
      ...(isAdmin() ? [['Users', 'Manage workspace users and access.', '/users']] : []),
      ['Orders', 'Review order intake and fulfillment status.', '/orders'],
      ['Products', 'Manage inventory and shipping supplies.', '/products'],
      ['Payments', 'Review invoices and payment status.', '/payments'],
      ['Analytics', 'View delivery and support metrics.', '/analytics'],
      ['Warehouses', 'Manage hubs and capacity.', '/warehouses'],
      ['Plan route', 'Compare ETA and service options.', '/routes'],
      ['Pickup desk', 'Book, edit, and monitor pickups.', '/pickups'],
      ['Store shipping', 'Manage ecommerce order movement.', '/stores'],
      ['Packaging guide', 'Prepare parcels for safer movement.', '/packaging'],
      ['Heavy freight', 'Manage oversized shipment quotes.', '/freight'],
      ['Alerts', 'Manage notifications and updates.', '/notifications'],
    ];
    return layout(`
      <section class="dynamic-panel">
        <p class="home-kicker">More tools</p>
        <h1>More</h1>
        <p class="muted-text">Remaining workspace features, account tools, reports, support, and session actions.</p>
      </section>
      <section class="dynamic-grid">
        ${items.map(([title, text, href]) => `<article class="dynamic-card actionable-card" tabindex="0" data-card-href="${href}">
          <h3>${title}</h3>
          <p class="muted-text">${text}</p>
          <a href="${href}" data-link>Open</a>
        </article>`).join('')}
        <article class="dynamic-card">
          <h3>Logout</h3>
          <p class="muted-text">End the current session after confirmation.</p>
          <button class="table-action" type="button" data-action="logout">Logout</button>
        </article>
      </section>
    `, '/more', [['Home', '/'], ['More', '/more']]);
  }

  function sumAmounts(rows) {
    return rows.reduce((sum, row) => sum + Number(row.amount || 0), 0).toLocaleString();
  }

  function notFoundPage(title = '404 Page Not Found') {
    return layout(`<section class="dynamic-panel"><h1>${escapeHtml(title)}</h1><p class="muted-text">The requested route or data record does not exist.</p><a class="btn btn-primary" href="/" data-link>Back to dashboard</a></section>`, '/404');
  }

  function downloadJson(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function confirmAction(title, message) {
    const dialog = document.getElementById('confirmDialog');
    if (!dialog?.showModal) return Promise.resolve(window.confirm(message));
    dialog.querySelector('#confirmTitle').textContent = title;
    dialog.querySelector('#confirmMessage').textContent = message;
    dialog.showModal();
    return new Promise((resolve) => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
    });
  }

  function openEntityDialog(entity, id) {
    const cfg = entityConfig[entity];
    const dialog = document.getElementById('entityDialog');
    const form = document.getElementById('entityForm');
    if (!dialog || !form || !cfg) return;
    form.reset();
    form.dataset.entity = entity;
    const row = id ? state.db[entity].find((item) => item.id === id) : null;
    form.querySelector('[name="id"]').value = row?.id || '';
    cfg.fields.forEach((field) => { form.elements[field].value = row?.[field] || ''; });
    document.getElementById('entityDialogTitle').textContent = `${row ? 'Edit' : 'Add'} ${cfg.singular}`;
    dialog.showModal();
  }

  async function deleteRow(entity, id) {
    const ok = await confirmAction('Delete record', 'Delete this item permanently?');
    if (!ok) return;
    state.db[entity] = state.db[entity].filter((item) => item.id !== id);
    await deleteWorkspaceItem(entity, id);
    persist();
    toast('Delete success');
    if (normalizePath().startsWith(`/${entity}/`)) go(`/${entity}`);
    else render();
  }

  function applyTableFilters() {
    const table = document.querySelector('[data-entity-table]');
    if (!table) return;
    const search = document.querySelector('[data-table-search]')?.value.trim().toLowerCase() || '';
    const filter = document.querySelector('[data-table-filter]')?.value || '';
    const sort = document.querySelector('[data-table-sort]')?.value || '';
    const entity = table.dataset.entityTable;
    const tbody = table.querySelector('tbody');
    const rows = [...state.db[entity]];
    rows.sort((a, b) => String(a[sort] || '').localeCompare(String(b[sort] || '')));
    tbody.innerHTML = rows.map((row) => rowTemplate(entity, row)).join('');
    let shown = 0;
    tbody.querySelectorAll('[data-row-id]').forEach((row) => {
      const matchSearch = !search || row.dataset.search.includes(search);
      const matchFilter = !filter || row.dataset.filter === filter;
      row.hidden = !(matchSearch && matchFilter);
      if (!row.hidden) shown += 1;
    });
    document.querySelector('[data-filter-empty]')?.toggleAttribute('hidden', shown !== 0);
  }

  function bindPage() {
    document.querySelectorAll('[data-link]').forEach((link) => {
      link.addEventListener('click', (event) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('mailto:')) return;
        event.preventDefault();
        go(href);
      });
    });

    document.querySelectorAll('[data-card-href]').forEach((card) => {
      const open = () => go(card.dataset.cardHref);
      card.addEventListener('click', (event) => { if (!event.target.closest('a,button,select,input')) open(); });
      card.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') open(); });
    });

    document.querySelector('[data-action="logout"]')?.addEventListener('click', async () => {
      if (!(await confirmAction('Logout', 'Do you want to logout?'))) return;
      clearAuth();
      toast('Logged out');
      go('/');
    });

    document.querySelectorAll('[data-action="print"]').forEach((button) => button.addEventListener('click', () => window.print()));
    document.querySelectorAll('[data-action="back"]').forEach((button) => button.addEventListener('click', () => history.length > 1 ? history.back() : go('/')));
    document.querySelectorAll('[data-action="download"]').forEach((button) => {
      button.addEventListener('click', () => downloadJson(`${button.dataset.entity || 'zyraviq'}-export.json`, state.db[button.dataset.entity] || state.db));
    });
    document.querySelectorAll('[data-action="download-report"]').forEach((button) => {
      button.addEventListener('click', () => downloadJson(`${button.dataset.report}.json`, state.db));
    });
    document.querySelector('[data-action="download-data-center"]')?.addEventListener('click', () => {
      downloadJson('zyraviq-data-center-export.json', buildDataCenterReport());
    });

    document.querySelectorAll('[data-action="add"]').forEach((button) => button.addEventListener('click', () => openEntityDialog(button.dataset.entity)));
    document.querySelectorAll('[data-action="edit"]').forEach((button) => button.addEventListener('click', () => openEntityDialog(button.dataset.entity, button.dataset.id)));
    document.querySelectorAll('[data-action="delete"]').forEach((button) => button.addEventListener('click', () => deleteRow(button.dataset.entity, button.dataset.id)));
    document.querySelector('[data-action="close-dialog"]')?.addEventListener('click', async () => {
      const form = document.getElementById('entityForm');
      if (form?.dataset.dirty === 'true' && !(await confirmAction('Discard changes', 'Cancel without saving changes?'))) return;
      document.getElementById('entityDialog')?.close();
    });

    document.querySelectorAll('[data-dirty-form]').forEach((form) => {
      form.addEventListener('input', () => { form.dataset.dirty = 'true'; });
    });
    document.querySelectorAll('[data-action="cancel-form"]').forEach((button) => {
      button.addEventListener('click', async () => {
        const form = button.closest('form');
        if (form?.dataset.dirty === 'true' && !(await confirmAction('Discard changes', 'Cancel without saving changes?'))) return;
        history.length > 1 ? history.back() : go('/');
      });
    });

    document.getElementById('entityForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const entity = form.dataset.entity;
      const values = Object.fromEntries(new FormData(form));
      const id = values.id || `${entity}-${Date.now()}`;
      delete values.id;
    const existing = state.db[entity].findIndex((row) => row.id === id);
    const now = new Date().toISOString();
    const record = { id, ...values, createdAt: state.db[entity][existing]?.createdAt || now, updatedAt: now };
    const saved = await saveWorkspaceItem(entity, record);
    if (existing >= 0) state.db[entity][existing] = { ...state.db[entity][existing], ...saved };
    else state.db[entity].unshift(saved);
      persist();
      document.getElementById('entityDialog')?.close();
      toast(existing >= 0 ? 'Edit success' : 'Add success');
      render();
    });

    document.querySelectorAll('[data-table-search], [data-table-filter], [data-table-sort]').forEach((control) => {
      control.addEventListener('input', applyTableFilters);
      control.addEventListener('change', applyTableFilters);
    });
    applyTableFilters();

    document.getElementById('loginForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(event.currentTarget));
      if (!event.currentTarget.reportValidity()) return;
      saveAuth({ id: `usr-${Date.now()}`, name: values.role === 'admin' ? 'Admin User' : 'Customer User', email: values.email, role: values.role, companyName: state.db.settings.companyName });
      toast('Login successful');
      go(values.role === 'admin' ? '/admin' : '/dashboard');
    });

    document.getElementById('registerForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const user = { id: `usr-${Date.now()}`, name: values.name, email: values.email, role: values.role, status: 'Active', companyName: state.db.settings.companyName };
      state.db.users.unshift(user);
      persist();
      saveAuth(user);
      toast('Account created');
      go(values.role === 'admin' ? '/admin' : '/dashboard');
    });

    document.getElementById('trackingForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = document.getElementById('trackingInput');
      if (!input?.value.trim()) return;
      renderTracking(input.value.trim());
    });
    const queryTracking = new URLSearchParams(location.search).get('tracking');
    if (queryTracking && document.getElementById('trackingInput')) {
      document.getElementById('trackingInput').value = queryTracking;
      renderTracking(queryTracking);
    }

    document.getElementById('settingsForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      const values = Object.fromEntries(new FormData(event.currentTarget));
      state.db.settings = {
        companyName: values.companyName,
        defaultCurrency: values.defaultCurrency,
        emailAlerts: Boolean(values.emailAlerts),
        smsAlerts: Boolean(values.smsAlerts),
      };
      persist();
      event.currentTarget.dataset.dirty = 'false';
      document.getElementById('settingsHint').textContent = 'Settings saved.';
      toast('Save success');
    });

    document.getElementById('profileForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const hint = document.getElementById('profileHint');
      const payload = {
        name: String(values.name || '').trim(),
        email: String(values.email || '').trim(),
        companyName: String(values.companyName || '').trim(),
        panNumber: String(values.panNumber || '').trim().toUpperCase(),
        gstNumber: String(values.gstNumber || '').trim().toUpperCase(),
        phoneCountry: String(values.phoneCountry || '').trim(),
        phoneCountryCode: String(values.phoneCountryCode || '').trim(),
        phoneNumber: String(values.phoneNumber || '').trim(),
      };

      if (!isMockToken()) {
        try {
          if (hint) hint.textContent = 'Saving...';
          const response = await fetch(`${apiBase}/api/auth/me`, {
            method: 'PATCH',
            headers: apiHeaders(true),
            body: JSON.stringify(payload),
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.message || 'Profile update failed');
          state.user = data.user;
        } catch (error) {
          if (hint) hint.textContent = error.message;
          toast(error.message, 'error');
          return;
        }
      } else {
        state.user = {
          ...state.user,
          name: payload.name,
          email: payload.email,
          companyName: payload.companyName,
          panNumber: payload.panNumber,
          gstNumber: payload.gstNumber,
          phone: {
            country: payload.phoneCountry,
            countryCode: payload.phoneCountryCode,
            number: payload.phoneNumber,
            fullNumber: `${payload.phoneCountryCode}${payload.phoneNumber}`,
          },
        };
      }

      state.db.settings.companyName = state.user.companyName || state.db.settings.companyName;
      localStorage.setItem('user', JSON.stringify(state.user));
      localStorage.setItem('userRole', state.user.role || '');
      if (state.user.companyId) localStorage.setItem('companyId', state.user.companyId);
      persist();
      event.currentTarget.dataset.dirty = 'false';
      if (hint) hint.textContent = 'Profile saved.';
      toast('Save success');
      render();
    });

    if (new URLSearchParams(location.search).get('action') === 'add') {
      const entity = normalizePath().split('/')[1];
      setTimeout(() => openEntityDialog(entity), 50);
    }
  }

  function render() {
    const path = normalizePath();
    const segments = path.split('/').filter(Boolean);
    app.innerHTML = loadingShell();
    setTimeout(() => {
      if (path === '/') app.innerHTML = homePage();
      else if (path === '/login') app.innerHTML = loginPage();
      else if (path === '/register') app.innerHTML = registerPage();
      else if (path === '/dashboard') app.innerHTML = dashboardPage(false);
      else if (path === '/admin') app.innerHTML = dashboardPage(true);
      else if (path === '/tracking') app.innerHTML = trackingPage();
      else if (path === '/shipping') app.innerHTML = shippingPage();
      else if (path === '/analytics') app.innerHTML = analyticsPage();
      else if (path === '/data-center') app.innerHTML = dataCenterPage();
      else if (path === '/reports') app.innerHTML = reportsPage();
      else if (path === '/settings') app.innerHTML = settingsPage();
      else if (path === '/profile') app.innerHTML = profilePage();
      else if (path === '/more') app.innerHTML = morePage();
      else if (entityConfig[segments[0]] && segments[1]) app.innerHTML = detailPage(segments[0], decodeURIComponent(segments[1]));
      else if (entityConfig[segments[0]]) app.innerHTML = entityPage(segments[0]);
      else app.innerHTML = notFoundPage();
      bindPage();
    }, 120);
  }

  function loadingShell() {
    return `
      <div class="app-splash" role="status" aria-live="polite">
        <div class="app-splash__brand"><span>ZYRAVIQ</span><small>AI</small></div>
        <div class="app-splash__panel">
          <div class="app-splash__line app-splash__line--wide"></div>
          <div class="app-splash__line"></div>
          <div class="app-splash__grid">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>
    `;
  }

  window.addEventListener('popstate', render);
  loadWorkspaceFromMongo().catch(() => {
    state.backendReady = false;
  }).finally(render);
})();
