(function () {
  const app = document.getElementById('app');
  const storeKey = 'shipxWorkspace.v2';
  const apiBase = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:4000'
    : location.origin;

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
    '/shipx-one-stop-shop': '/dashboard',
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
        { id: 'usr-1', name: 'Admin User', email: 'admin@shipx.test', role: 'admin', status: 'Active' },
        { id: 'usr-2', name: 'Customer User', email: 'customer@shipx.test', role: 'customer', status: 'Active' },
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
          trackingNumber: 'SX-DEMO-1001',
          origin: 'Mumbai Hub',
          destination: 'Delhi Customer',
          status: 'In Transit',
          currentLocation: 'Jaipur Linehaul',
          eta: tomorrow(2),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'shp-2',
          trackingNumber: 'SX-DEMO-1002',
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
        { id: 'not-1', title: 'Shipment moved', message: 'SX-DEMO-1001 crossed Jaipur hub.', type: 'Shipment', status: 'Unread' },
        { id: 'not-2', title: 'Payment received', message: 'Invoice INV-9001 was marked paid.', type: 'Payment', status: 'Read' },
      ],
      settings: {
        companyName: 'shipX Demo Workspace',
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
    let key = localStorage.getItem('shipxWorkspaceSession');
    if (!key) {
      key = `shipx-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      localStorage.setItem('shipxWorkspaceSession', key);
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
      ['Users', '/users'],
      ['Payments', '/payments'],
      ['Analytics', '/analytics'],
      ['Reports', '/reports'],
      ['Support', '/support'],
      ['Settings', '/settings'],
    ];
    return `
      <div class="app-shell">
        <header class="app-header">
          <div class="app-header-inner">
            <a href="/" class="app-logo" data-link><span>ship</span><strong>X</strong><small>AI</small></a>
            <nav class="app-nav" aria-label="Primary navigation">
              ${nav.map(([label, href]) => `<a href="${href}" class="${active === href ? 'active' : ''}" data-link>${label}</a>`).join('')}
            </nav>
            <div class="app-user">
              ${signedIn() ? `
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
        <main class="app-main">
          ${breadcrumbs(crumbs.length ? crumbs : [['Dashboard', '/'], [pageTitle(active), active]])}
          ${content}
        </main>
        ${bottomNav(active)}
        <footer class="app-footer">shipX AI Logistics workspace</footer>
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
        return `<a class="mobile-bottom-nav__item ${isActive ? 'active' : ''}" href="${href}" data-link aria-label="${label}" ${isActive ? 'aria-current="page"' : ''}>
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
    return `<nav class="breadcrumbs" aria-label="Breadcrumb">
      ${items.map(([label, href], index) => index === items.length - 1
        ? `<span>${escapeHtml(label)}</span>`
        : `<a href="${href}" data-link>${escapeHtml(label)}</a><span aria-hidden="true">/</span>`).join('')}
    </nav>`;
  }

  function homePage() {
    const cards = [
      ['Shipments', 'Create, edit, delete, track, download, and print shipments.', '/shipments'],
      ['Orders', 'Manage ecommerce and pickup orders with status filters.', '/orders'],
      ['Products', 'Maintain shipping supplies and product inventory.', '/products'],
      ['Analytics', 'Review delivery, revenue, fraud, and SLA metrics.', '/analytics'],
      ['Support', 'Open and resolve delivery or account tickets.', '/support'],
      ['Settings', 'Control profile, notifications, and workspace preferences.', '/settings'],
    ];
    return layout(`
      <section class="hero-dynamic">
        <div class="dynamic-panel dynamic-hero-copy">
          <p class="home-kicker">AI logistics operations</p>
          <h1>One working place for every visible shipX action.</h1>
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
          <button class="btn-secondary" type="button" data-action="print">Print snapshot</button>
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
    `, '/');
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
    `, '/shipping', [['Dashboard', '/'], ['Shipping', '/shipping']]);
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
            <label class="field"><span>Email</span><input class="input" name="email" type="email" required value="admin@shipx.test" /></label>
            <label class="field"><span>Password</span><input class="input" name="password" type="password" required minlength="4" value="demo123" /></label>
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
    `, `/${entity}`, [['Dashboard', '/'], [cfg.title, `/${entity}`]]);
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
    `, `/${entity}`, [['Dashboard', '/'], [cfg.title, `/${entity}`], ['Details', `/${entity}/${id}`]]);
  }

  function trackingPage() {
    return layout(`
      <section class="dynamic-panel">
        <p class="home-kicker">Live tracking</p>
        <h1>Tracking</h1>
        <form id="trackingForm" class="dynamic-form">
          <div class="form-row">
            <label class="field"><span>Tracking number</span><input id="trackingInput" class="input" required placeholder="SX-DEMO-1001" /></label>
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
    result.innerHTML = `
      <div class="dynamic-panel"><h2>${escapeHtml(shipment.trackingNumber)}</h2><p><span class="status-pill">${escapeHtml(shipment.status)}</span></p>
        <table class="data-table"><tbody>
          <tr><th>Origin</th><td>${escapeHtml(shipment.origin)}</td></tr>
          <tr><th>Destination</th><td>${escapeHtml(shipment.destination)}</td></tr>
          <tr><th>Current location</th><td>${escapeHtml(shipment.currentLocation || shipment.origin)}</td></tr>
          <tr><th>ETA</th><td>${escapeHtml(new Date(shipment.eta).toLocaleString())}</td></tr>
        </tbody></table></div>
      <div class="dynamic-panel"><h2>Actions</h2><div class="dynamic-actions">
        <a class="btn btn-primary" href="/shipments/${encodeURIComponent(shipment.id)}" data-link>View shipment</a>
        <button class="btn-secondary" type="button" data-action="print">Print</button>
        <button class="btn-secondary" type="button" data-entity="shipments" data-action="download">Download</button>
      </div></div>`;
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
    return layout(`
      <section class="dynamic-panel"><p class="home-kicker">Profile</p><h1>Profile</h1></section>
      <section class="dynamic-panel">
        <form id="profileForm" class="dynamic-form" data-dirty-form>
          <label class="field"><span>Name</span><input class="input" name="name" required value="${escapeHtml(state.user?.name || '')}" /></label>
          <label class="field"><span>Email</span><input class="input" name="email" type="email" required value="${escapeHtml(state.user?.email || '')}" /></label>
          <label class="field"><span>Role</span><select class="select" name="role"><option value="customer" ${state.user?.role === 'customer' ? 'selected' : ''}>Customer</option><option value="admin" ${state.user?.role === 'admin' ? 'selected' : ''}>Admin</option></select></label>
          <div class="dynamic-actions"><button class="btn btn-primary" type="submit">Save</button><button class="btn-secondary" type="button" data-action="cancel-form">Cancel</button></div>
          <div class="hint" id="profileHint" role="alert"></div>
        </form>
      </section>
    `, '/profile');
  }

  function morePage() {
    const items = [
      ['Profile', 'Manage account details and role.', '/profile'],
      ['Settings', 'Update alerts and workspace preferences.', '/settings'],
      ['Reports', 'Download and print operational reports.', '/reports'],
      ['Support', 'Create tickets and delivery help requests.', '/support?action=add'],
      ['Users', 'Manage workspace users and access.', '/users'],
      ['Payments', 'Review invoices and payment status.', '/payments'],
      ['Analytics', 'View delivery and support metrics.', '/analytics'],
      ['Warehouses', 'Manage hubs and capacity.', '/warehouses'],
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
    `, '/more', [['Dashboard', '/'], ['More', '/more']]);
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
      button.addEventListener('click', () => downloadJson(`${button.dataset.entity || 'shipx'}-export.json`, state.db[button.dataset.entity] || state.db));
    });
    document.querySelectorAll('[data-action="download-report"]').forEach((button) => {
      button.addEventListener('click', () => downloadJson(`${button.dataset.report}.json`, state.db));
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
    const record = { id, ...values, updatedAt: new Date().toISOString() };
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

    document.getElementById('profileForm')?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!event.currentTarget.reportValidity()) return;
      const values = Object.fromEntries(new FormData(event.currentTarget));
      state.user = { ...state.user, ...values };
      localStorage.setItem('user', JSON.stringify(state.user));
      localStorage.setItem('userRole', state.user.role || '');
      event.currentTarget.dataset.dirty = 'false';
      document.getElementById('profileHint').textContent = 'Profile saved.';
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
    app.innerHTML = '<div class="app-main"><div class="loading-state">Loading...</div></div>';
    setTimeout(() => {
      if (path === '/') app.innerHTML = homePage();
      else if (path === '/login') app.innerHTML = loginPage();
      else if (path === '/register') app.innerHTML = registerPage();
      else if (path === '/dashboard') app.innerHTML = dashboardPage(false);
      else if (path === '/admin') app.innerHTML = dashboardPage(true);
      else if (path === '/tracking') app.innerHTML = trackingPage();
      else if (path === '/shipping') app.innerHTML = shippingPage();
      else if (path === '/analytics') app.innerHTML = analyticsPage();
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

  window.addEventListener('popstate', render);
  loadWorkspaceFromMongo().catch(() => {
    state.backendReady = false;
  }).finally(render);
})();
