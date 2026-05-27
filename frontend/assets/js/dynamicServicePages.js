(function () {
  const pageBlueprints = {
    'ship-now': {
      page: 'ship-now',
      kicker: 'Shipment desk',
      title: 'Ship Now',
      lead: 'Create a parcel or freight shipment with package details, pickup timing, route context, and live tracking ready from the first scan.',
      note: 'Built for teams that need fewer forms and cleaner handoffs between customer, warehouse, and admin workflows.',
      primaryAction: { label: 'Start shipping', href: './register.html' },
      secondaryAction: { label: 'Track shipment', href: './tracking.html' },
      visual: { code: 'SX', title: 'Shipment draft', meta: 'Origin -> Pickup -> Route -> ETA', stats: ['2 min setup', 'AI ETA', 'Live status'] },
      metrics: [
        { value: '3 steps', label: 'details, pickup, confirm' },
        { value: 'AI ETA', label: 'route estimate before handoff' },
        { value: 'Live', label: 'tracking after shipment creation' },
      ],
      cards: [
        { title: 'Package details', text: 'Capture origin, destination, weight, dimensions, package type, and service preference in one shipping flow.' },
        { title: 'Pickup planning', text: 'Choose a collection window and keep pickup context available for operations and customer dashboards.' },
        { title: 'Tracking ready', text: 'Send the shipment directly into route tracking, timeline updates, notifications, and AI status summaries.' },
      ],
      steps: ['Enter route and package details', 'Select pickup or drop-off workflow', 'Confirm and monitor shipment movement'],
      checklist: ['Business address ready', 'Package weight and dimensions', 'Receiver phone and delivery address', 'Pickup window preference'],
    },
    'rates-and-transit-times': {
      page: 'rates-and-transit-times',
      kicker: 'Route planning',
      title: 'Rates and Transit Times',
      lead: 'Compare service windows, delivery speed, route confidence, and expected handoff points before creating a shipment.',
      note: 'Use this view to plan cost-sensitive or time-sensitive movement without guessing the delivery path.',
      primaryAction: { label: 'View transit options', href: './tracking.html' },
      secondaryAction: { label: 'Create shipment', href: './ship-now.html' },
      visual: { code: 'ETA', title: 'Route comparison', meta: 'Air / Rail / Road / Last mile', stats: ['Fastest', 'Balanced', 'Economy'] },
      metrics: [
        { value: '4 modes', label: 'air, rail, road, last mile' },
        { value: 'ETA', label: 'AI-assisted delivery windows' },
        { value: 'Risk', label: 'weather and delay context' },
      ],
      cards: [
        { title: 'Transit windows', text: 'Estimate delivery bands for each movement option using route stage, distance, and hub context.' },
        { title: 'Rate context', text: 'Prepare pricing decisions with service type, shipment size, speed, and operational requirements in mind.' },
        { title: 'Confidence signals', text: 'Show delay risk, weather impact, current hub movement, and route confidence before booking.' },
      ],
      steps: ['Add origin and destination', 'Compare delivery windows', 'Choose a service and move to shipment creation'],
      checklist: ['Origin and destination city', 'Package size and weight', 'Preferred delivery date', 'Service priority'],
    },
    'schedule-manage-pickups': {
      page: 'schedule-manage-pickups',
      kicker: 'Pickup desk',
      title: 'Schedule and Manage Pickups',
      lead: 'Book collections, reschedule missed handoffs, and keep pickup status connected to shipment and warehouse operations.',
      note: 'Designed for daily teams that need to coordinate pickup changes without losing shipment context.',
      primaryAction: { label: 'Manage pickups', href: './customer-dashboard.html' },
      secondaryAction: { label: 'Create shipment', href: './ship-now.html' },
      visual: { code: 'PU', title: 'Pickup board', meta: 'Booked -> Assigned -> Collected', stats: ['Today', 'Slot edit', 'Hub handoff'] },
      metrics: [
        { value: 'Today', label: 'collection slots' },
        { value: 'Live', label: 'pickup status updates' },
        { value: 'Hub', label: 'warehouse handoff visibility' },
      ],
      cards: [
        { title: 'Slot selection', text: 'Show available collection windows by city, hub, warehouse, or operational capacity.' },
        { title: 'Reschedule flow', text: 'Move pickup timing while keeping package, tracking, and customer information intact.' },
        { title: 'Driver handoff', text: 'Give operations a simple view of assigned pickups, collected parcels, and pending exceptions.' },
      ],
      steps: ['Choose shipment or package batch', 'Pick a collection slot', 'Track assigned pickup and handoff'],
      checklist: ['Pickup address', 'Contact person', 'Package count', 'Preferred time window'],
    },
    ecommerce: {
      page: 'ecommerce',
      kicker: 'Store operations',
      title: 'Ecommerce Shipping',
      lead: 'Move online orders from store intake to fulfillment, tracking, customer notifications, and delivery exception handling.',
      note: 'Built for sellers who need order movement, labels, route status, and support context in one workspace.',
      primaryAction: { label: 'Enable ecommerce', href: './register.html' },
      secondaryAction: { label: 'Open dashboard', href: './customer-dashboard.html' },
      visual: { code: 'EC', title: 'Order flow', meta: 'Store -> Label -> Fulfillment -> Customer', stats: ['Bulk orders', 'Labels', 'Alerts'] },
      metrics: [
        { value: 'Orders', label: 'ready for channel sync' },
        { value: 'Labels', label: 'shipping workflow' },
        { value: 'Alerts', label: 'customer updates' },
      ],
      cards: [
        { title: 'Order intake', text: 'Prepare marketplace and storefront orders for shipment creation and tracking assignment.' },
        { title: 'Fulfillment rules', text: 'Route orders by city, inventory location, service level, warehouse, or promised delivery window.' },
        { title: 'Customer visibility', text: 'Keep buyers informed with tracking updates, ETA changes, and exception notices.' },
      ],
      steps: ['Import or enter orders', 'Apply fulfillment rules', 'Ship and notify customers'],
      checklist: ['Store order data', 'SKU/package mapping', 'Warehouse location', 'Notification preference'],
    },
    'packaging-shipping-supplies': {
      page: 'packaging-shipping-supplies',
      kicker: 'Packaging guide',
      title: 'Packaging and Shipping Supplies',
      lead: 'Prepare parcels with the right packaging, label placement, handling notes, and shipment-ready checks.',
      note: 'Good packaging reduces failed scans, transit damage, delay disputes, and support escalations.',
      primaryAction: { label: 'Prepare package', href: './ship-now.html' },
      secondaryAction: { label: 'Contact support', href: './contact.html' },
      visual: { code: 'PKG', title: 'Ready to move', meta: 'Box -> Cushion -> Seal -> Label', stats: ['Fragile', 'Scan-ready', 'Secure'] },
      metrics: [
        { value: 'Safe', label: 'handling guidance' },
        { value: 'Labels', label: 'scan accuracy' },
        { value: 'Ready', label: 'pickup prep' },
      ],
      cards: [
        { title: 'Box selection', text: 'Match package size, weight, and protection level to the shipment profile.' },
        { title: 'Label checks', text: 'Place tracking labels where they scan cleanly and avoid tape over barcodes or QR codes.' },
        { title: 'Handling notes', text: 'Mark fragile, liquid, cold-chain, oversized, or high-value parcels before handoff.' },
      ],
      steps: ['Choose box and internal protection', 'Seal and label clearly', 'Add handling notes before pickup'],
      checklist: ['Correct box size', 'Internal cushioning', 'Readable label', 'Fragile or special handling note'],
    },
    'quote-heavy-shipment': {
      page: 'quote-heavy-shipment',
      kicker: 'Freight planning',
      title: 'Quote Heavy Shipment',
      lead: 'Plan oversized, palletized, or high-weight shipments with dimensions, loading needs, route review, and support follow-up.',
      note: 'Heavy freight needs clearer data up front so operations can choose the right vehicle, hub, and handling path.',
      primaryAction: { label: 'Request quote', href: './contact.html' },
      secondaryAction: { label: 'Plan route', href: './rates-and-transit-times.html' },
      visual: { code: 'FT', title: 'Freight quote', meta: 'Dimensions -> Handling -> Route -> Quote', stats: ['Pallet', 'Liftgate', 'Risk review'] },
      metrics: [
        { value: 'Freight', label: 'oversized support' },
        { value: 'Hub', label: 'warehouse planning' },
        { value: 'Risk', label: 'AI route review' },
      ],
      cards: [
        { title: 'Dimensions', text: 'Capture length, width, height, weight, pallet count, and loading constraints.' },
        { title: 'Route review', text: 'Compare movement options and warehouse handoffs before confirming the freight plan.' },
        { title: 'Exception care', text: 'Flag insurance, customs, fragile handling, and access limitations early.' },
      ],
      steps: ['Enter freight dimensions', 'Share pickup and loading needs', 'Review quote and route option'],
      checklist: ['Weight and dimensions', 'Pallet count', 'Loading equipment needs', 'Pickup access notes'],
    },
    'shipping-services': {
      page: 'shipping-services',
      kicker: 'Service catalog',
      title: 'Shipping Services',
      lead: 'Browse parcel, freight, domestic, priority, and economy services from one logistics workspace.',
      note: 'Use this catalog to choose the right service before creating a shipment or comparing transit options.',
      primaryAction: { label: 'View all services', href: './ship-now.html' },
      secondaryAction: { label: 'Compare transit', href: './rates-and-transit-times.html' },
      visual: { code: 'SVC', title: 'Service menu', meta: 'Express / Standard / Freight', stats: ['Domestic', 'Priority', 'Freight'] },
      metrics: [
        { value: 'Domestic', label: 'parcel and freight' },
        { value: 'Global', label: 'cross-border ready' },
        { value: 'AI', label: 'routing context' },
      ],
      cards: [
        { title: 'Express', text: 'Fast parcel movement for urgent deliveries and time-sensitive customer promises.' },
        { title: 'Standard', text: 'Reliable service for regular shipments that need balanced cost and speed.' },
        { title: 'Freight', text: 'Support for heavy, palletized, oversized, and scheduled movement.' },
      ],
      steps: ['Choose service type', 'Compare speed and handling', 'Create shipment or request help'],
      checklist: ['Delivery priority', 'Package category', 'Destination type', 'Special handling need'],
    },
    'shipping-tools': {
      page: 'shipping-tools',
      kicker: 'Operations toolkit',
      title: 'Shipping Tools',
      lead: 'Use tracking, pickup, routing, warehouse, account, and support tools from one clean logistics workspace.',
      note: 'These tools are designed for repeated daily operations, not a one-time marketing page.',
      primaryAction: { label: 'View tools', href: './register.html' },
      secondaryAction: { label: 'Track shipment', href: './tracking.html' },
      visual: { code: 'TLS', title: 'Tool stack', meta: 'Track / Plan / Pickup / Warehouse', stats: ['Track', 'Plan', 'Manage'] },
      metrics: [
        { value: 'Track', label: 'live shipment lookup' },
        { value: 'Plan', label: 'route and pickup' },
        { value: 'Manage', label: 'account workspace' },
      ],
      cards: [
        { title: 'Tracking', text: 'Find shipment status, AI delivery context, route progress, and delay reason.' },
        { title: 'Pickup manager', text: 'Coordinate package collection, missed pickup changes, and warehouse handoff.' },
        { title: 'Warehouse view', text: 'Connect shipments to inventory, hubs, notifications, and admin workflows.' },
      ],
      steps: ['Pick the operation', 'Enter shipment or account context', 'Act from dashboard or tool page'],
      checklist: ['Tracking number', 'Account access', 'Shipment details', 'Warehouse or pickup context'],
    },
    'shipx-one-stop-shop': {
      page: 'shipx-one-stop-shop',
      kicker: 'Unified workspace',
      title: 'shipX One Stop Shop',
      lead: 'Bring quotes, shipment creation, tracking, support, dashboards, and AI assistance into one everyday logistics experience.',
      note: 'A single place for customers and operators to move from planning to resolution without losing context.',
      primaryAction: { label: 'Explore services', href: './customer-dashboard.html' },
      secondaryAction: { label: 'Open account', href: './register.html' },
      visual: { code: 'ONE', title: 'All workflows', meta: 'Quote -> Ship -> Track -> Resolve', stats: ['One view', 'Live data', 'AI assist'] },
      metrics: [
        { value: 'One', label: 'workspace' },
        { value: 'Live', label: 'shipment context' },
        { value: 'AI', label: 'operational assist' },
      ],
      cards: [
        { title: 'Create', text: 'Start shipments and collect operational details from one place.' },
        { title: 'Monitor', text: 'Track status, ETA, delay reason, weather, and fraud signals.' },
        { title: 'Resolve', text: 'Use support and dashboards to handle exceptions, account tasks, and pickup issues.' },
      ],
      steps: ['Plan shipment or quote', 'Move shipment into tracking', 'Resolve changes from one workspace'],
      checklist: ['Account access', 'Shipment details', 'Support context', 'Dashboard role'],
    },
    contact: {
      page: 'contact',
      kicker: 'Support center',
      title: 'Contact shipX',
      lead: 'Get help with tracking, account access, pickup changes, freight quotes, packaging questions, and delivery exceptions.',
      note: 'Support works best when you include tracking IDs, account email, shipment route, and the exact issue.',
      primaryAction: { label: 'Email support', href: 'mailto:support@shipxlogistics.example' },
      secondaryAction: { label: 'Track first', href: './tracking.html' },
      visual: { code: 'HELP', title: 'Support routing', meta: 'Track -> Diagnose -> Resolve', stats: ['24/7 context', 'Fast lookup', 'Team routing'] },
      metrics: [
        { value: '24/7', label: 'tracking context' },
        { value: 'Fast', label: 'shipment lookup' },
        { value: 'Team', label: 'support routing' },
      ],
      cards: [
        { title: 'Shipment issue', text: 'Share tracking IDs so support can check route, ETA, and visible exception signals.' },
        { title: 'Account help', text: 'Resolve login, company profile, dashboard role, and workspace access questions.' },
        { title: 'Operational support', text: 'Get help with pickups, freight, packaging, delays, address changes, and risk reports.' },
      ],
      steps: ['Choose the issue type', 'Share tracking or account context', 'Get routed to the right support path'],
      checklist: ['Tracking number if available', 'Account email', 'Shipment route', 'Issue description'],
    },
  };

  const servicePages = new Set(Object.keys(pageBlueprints));

  function apiBase() {
    if (window.__getApiBase) return window.__getApiBase();
    if (window.API_BASE_URL) return String(window.API_BASE_URL).replace(/\/$/, '');
    const host = location.hostname || 'localhost';
    return host === 'localhost' || host === '127.0.0.1' ? 'http://localhost:4000' : location.origin;
  }

  function pageKey() {
    const last = location.pathname.split('/').pop() || '';
    return last.replace(/\.html$/i, '').toLowerCase();
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

  function mergeSchema(local, remote) {
    if (!remote || !remote.title) return local;
    return {
      ...local,
      ...remote,
      visual: remote.visual || local.visual,
      metrics: Array.isArray(remote.metrics) && remote.metrics.length ? remote.metrics : local.metrics,
      cards: Array.isArray(remote.cards) && remote.cards.length ? remote.cards : local.cards,
      steps: Array.isArray(remote.steps) && remote.steps.length ? remote.steps : local.steps,
      checklist: Array.isArray(remote.checklist) && remote.checklist.length ? remote.checklist : local.checklist,
    };
  }

  async function loadSchema(key) {
    const local = pageBlueprints[key];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 900);
    try {
      const response = await fetch(`${apiBase()}/api/ui/public-schema/${encodeURIComponent(key)}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) return mergeSchema(local, data);
    } catch {}
    finally {
      clearTimeout(timer);
    }
    return local;
  }

  function actionLink(action, className) {
    if (!action?.href || !action?.label) return '';
    return `<a class="${className}" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`;
  }

  function renderHero(hero, schema) {
    const visual = schema.visual || {};
    hero.setAttribute('data-dynamic-page', schema.page);
    hero.innerHTML = `
      <div class="service-hero-copy">
        <p class="home-kicker">${escapeHtml(schema.kicker || 'shipX workspace')}</p>
        <h1>${escapeHtml(schema.title)}</h1>
        <p class="account-hero__lead">${escapeHtml(schema.lead || '')}</p>
        <p class="account-hero__note">${escapeHtml(schema.note || '')}</p>
        <div class="service-hero-actions">
          ${actionLink(schema.primaryAction, 'signup-button')}
          ${actionLink(schema.secondaryAction, 'service-secondary-action')}
        </div>
      </div>
      <div class="service-hero-visual" aria-hidden="true">
        <div class="service-visual-code">${escapeHtml(visual.code || 'AI')}</div>
        <div class="service-visual-card">
          <span>${escapeHtml(visual.title || schema.title)}</span>
          <b>${escapeHtml(visual.meta || 'Live logistics workspace')}</b>
          <div>
            ${(visual.stats || []).map((item) => `<em>${escapeHtml(item)}</em>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  function renderSections(main, schema) {
    main.querySelector('.service-dynamic-section')?.remove();
    const section = document.createElement('section');
    section.className = 'service-dynamic-section';
    section.innerHTML = `
      <div class="service-metrics" aria-label="${escapeHtml(schema.title)} highlights">
        ${(schema.metrics || []).map((item) => `
          <article>
            <b>${escapeHtml(item.value)}</b>
            <span>${escapeHtml(item.label)}</span>
          </article>
        `).join('')}
      </div>

      <div class="service-card-grid">
        ${(schema.cards || []).map((item) => `
          <article>
            <h2>${escapeHtml(item.title)}</h2>
            <p>${escapeHtml(item.text)}</p>
          </article>
        `).join('')}
      </div>

      <div class="service-workflow">
        <div>
          <p class="home-kicker">Workflow</p>
          <h2>How this page helps</h2>
        </div>
        <ol>
          ${(schema.steps || []).map((step) => `<li>${escapeHtml(step)}</li>`).join('')}
        </ol>
      </div>

      <div class="service-checklist">
        <div>
          <p class="home-kicker">Before you start</p>
          <h2>Keep these details ready</h2>
        </div>
        <ul>
          ${(schema.checklist || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
    `;
    main.appendChild(section);
  }

  async function init() {
    const key = pageKey();
    if (!servicePages.has(key)) return;
    const hero = document.querySelector('.account-hero');
    const main = document.querySelector('main.container');
    if (!hero || !main) return;

    hero.setAttribute('aria-busy', 'true');
    const schema = await loadSchema(key);
    if (!schema) return;
    document.title = `${schema.title} - shipX AI Logistics`;
    renderHero(hero, schema);
    renderSections(main, schema);
    hero.setAttribute('aria-busy', 'false');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
