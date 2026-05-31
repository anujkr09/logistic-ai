/* Global UI helpers */
(function () {
  const BRAND_REPLACEMENTS = [
    [/ZYRAVIQ/g, 'ZYRAVIQ'],
    [/ZYRAVIQ/g, 'ZYRAVIQ'],
    [/zyraviq/g, 'zyraviq'],
    [/zyraviq/g, 'zyraviq'],
    [new RegExp(`SHI${'PX'}`, 'g'), 'ZYRAVIQ'],
    [new RegExp(`Shi${'pX'}`, 'g'), 'ZYRAVIQ'],
    [new RegExp(`shi${'px'}`, 'g'), 'zyraviq'],
    [/FEDEX/g, 'ZYRAVIQ'],
    [/FEDX/g, 'ZYRAVIQ'],
    [new RegExp(`\\bSHI${'PX'}-`, 'g'), 'ZQ-'],
    [new RegExp(`\\bS${'X'}-`, 'g'), 'ZQ-'],
    [/\bFX-/g, 'ZQ-'],
    [/\bFX\b/g, 'ZQ'],
  ];

  function replaceLegacyBrand(value) {
    if (typeof value !== 'string' || !value) return value;
    return BRAND_REPLACEMENTS.reduce((next, [pattern, replacement]) => next.replace(pattern, replacement), value);
  }

  function migrateLegacyBranding(root = document) {
    document.title = replaceLegacyBrand(document.title);
    document.body?.classList.replace('zyraviq-page', 'zyraviq-page');

    root.querySelectorAll?.('[class*="zyraviq"], [class*="zyraviq"]').forEach((el) => {
      el.className = replaceLegacyBrand(String(el.className || ''));
    });

    root.querySelectorAll?.('[title], [alt], [aria-label], [placeholder], [href], [download], [content]').forEach((el) => {
      ['title', 'alt', 'aria-label', 'placeholder', 'href', 'download', 'content'].forEach((attr) => {
        if (el.hasAttribute(attr)) el.setAttribute(attr, replaceLegacyBrand(el.getAttribute(attr)));
      });
    });

    root.querySelectorAll?.('.zyraviq-logo, .zyraviq-logo').forEach((logo) => {
      logo.className = replaceLegacyBrand(String(logo.className || ''));
      logo.setAttribute('aria-label', 'ZYRAVIQ AI Logistics home');
      logo.innerHTML = '<span>ZYR</span><strong>AVIQ</strong><small>AI</small>';
    });

    const walker = document.createTreeWalker(root.body || root, NodeFilter.SHOW_TEXT);
    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach((node) => {
      node.nodeValue = replaceLegacyBrand(node.nodeValue);
    });
  }

  migrateLegacyBranding();

  function ensureSkipLink() {
    if (document.querySelector('.skip-link')) return;
    const target = document.querySelector('main, .main, #app');
    if (!target) return;
    if (!target.id) target.id = 'mainContent';
    const link = document.createElement('a');
    link.className = 'skip-link';
    link.href = `#${target.id}`;
    link.textContent = 'Skip to content';
    document.body.prepend(link);
  }

  ensureSkipLink();

  if ('MutationObserver' in window) {
    const brandObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) migrateLegacyBranding(node);
          if (node.nodeType === Node.TEXT_NODE) node.nodeValue = replaceLegacyBrand(node.nodeValue);
        });
      });
    });
    brandObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  const themeToggle = document.getElementById('themeToggle');
  const toast = document.getElementById('toast');
  const installAppButton = document.querySelector('.install-app-button');
  const appRootUrl = new URL('../../', document.currentScript?.src || location.href);
  let deferredInstallPrompt = null;

  function resolveApiBase() {
    if (window.API_BASE_URL) return String(window.API_BASE_URL).replace(/\/$/, '');
    const host = location.hostname || 'localhost';
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    return isLocal ? 'http://localhost:4000' : location.origin;
  }

  const apiBase = resolveApiBase();
  window.API_BASE_URL = apiBase;
  window.__getApiBase = resolveApiBase;

  function userRole() {
    return localStorage.getItem('userRole') || '';
  }

  function isAdminRole(role = userRole()) {
    return role === 'admin' || role === 'warehouse_manager';
  }

  function roleHome(role = userRole()) {
    return isAdminRole(role) ? './admin-dashboard.html' : './customer-dashboard.html';
  }

  function pageUrl(page) {
    const inPages = location.pathname.includes('/pages/');
    return inPages ? `./${page}` : `./pages/${page}`;
  }

  function redirectLegacyStaticPage() {
    const legacyRoutes = {
      'admin-dashboard.html': '/admin',
      'contact.html': '/support?action=add',
      'create-user-id.html': '/register',
      'customer-dashboard.html': '/dashboard',
      'ecommerce.html': '/stores',
      'login.html': '/login',
      'packaging-shipping-supplies.html': '/packaging',
      'profile.html': '/profile',
      'quote-heavy-shipment.html': '/freight',
      'rates-and-transit-times.html': '/routes',
      'register.html': '/register',
      'schedule-manage-pickups.html': '/pickups',
      'ship-now.html': '/shipments?action=add',
      'shipping-services.html': '/shipments',
      'shipping-tools.html': '/analytics',
      'zyraviq-one-stop-shop.html': '/dashboard',
      'tracking.html': `/tracking${location.search || ''}`,
      'warehouses.html': '/warehouses',
    };
    const page = location.pathname.split('/').pop();
    if (!location.pathname.includes('/pages/') || !legacyRoutes[page]) return false;
    location.replace(legacyRoutes[page]);
    return true;
  }

  if (redirectLegacyStaticPage()) return;

  function workspaceUrl(path) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  function linkTitle(link) {
    return String(link.querySelector('b')?.textContent || link.textContent || '').trim().toLowerCase();
  }

  function setMenuCard(link, href, title, description) {
    link.href = workspaceUrl(href);
    const titleNode = link.querySelector('b');
    const descNode = link.querySelector('span');
    if (titleNode && title) titleNode.textContent = title;
    if (descNode && description) descNode.textContent = description;
  }

  function remapVisibleFeatureLinks() {
    const titleRoutes = {
      'create shipment': ['/shipments?action=add'],
      'plan route': ['/routes'],
      'pickup desk': ['/pickups'],
      'store shipping': ['/stores'],
      'live map': ['/tracking'],
      'my shipments': ['/shipments'],
      'alerts': ['/notifications'],
      'contact team': ['/support?action=add'],
      'delivery help': ['/support?filter=Open'],
      'packaging guide': ['/packaging'],
      'heavy freight': ['/freight'],
      'customer dashboard': ['/dashboard'],
      'admin console': ['/admin'],
      'dashboard': [isAdminRole() ? '/admin' : '/dashboard'],
      'profile': ['/profile'],
      'track shipment': ['/tracking'],
      'contact support': ['/support?action=add'],
      'rates and transit': ['/routes'],
      'warehouses': ['/warehouses'],
      'open an account': ['/register'],
      'open account': ['/register'],
      'sign in': ['/login'],
      'get started': ['/register'],
    };

    document.querySelectorAll('a').forEach((link) => {
      const title = linkTitle(link);
      const route = titleRoutes[title]?.[0];
      if (!route) return;
      link.href = workspaceUrl(route);
    });

    document.querySelectorAll('.zyraviq-menu-card').forEach((link) => {
      const title = linkTitle(link);
      if (title === 'dashboard' && link.closest('.zyraviq-menu--account')) {
        const cards = [...link.closest('.zyraviq-menu__grid')?.querySelectorAll('.zyraviq-menu-card') || []];
        const index = cards.indexOf(link);
        if (index === 0) setMenuCard(link, '/profile', 'Profile', 'Manage your active account details.');
        if (index === 1) setMenuCard(link, '/settings', 'Settings', 'Update alerts and workspace preferences.');
      }
    });
  }

  function setupLanguageSelector() {
    document.querySelectorAll('.language-card select').forEach((select) => {
      const stored = localStorage.getItem('zyraviqLanguage');
      if (stored && [...select.options].some((option) => option.value === stored || option.textContent === stored)) {
        select.value = stored;
      }
      select.addEventListener('change', () => {
        localStorage.setItem('zyraviqLanguage', select.value);
        showToast(`Language saved: ${select.value}`);
      });
    });
  }

  function enforceOpenAccountLinks() {
    const token = localStorage.getItem('token');
    const role = userRole();
    const dashboard = pageUrl(isAdminRole(role) ? 'admin-dashboard.html' : 'customer-dashboard.html');
    const profile = pageUrl('profile.html');

    document.querySelectorAll('.zyraviq-actions__item').forEach((item) => {
      if (!item.querySelector('.zyraviq-signin')) return;
      item.hidden = Boolean(token);
      item.setAttribute('aria-hidden', token ? 'true' : 'false');
    });

    document.querySelectorAll('a').forEach((link) => {
      const text = String(link.textContent || '').trim().toLowerCase();
      const href = String(link.getAttribute('href') || '').toLowerCase();
      const isLoginLink = href.endsWith('/login.html') || href.endsWith('./login.html') || href === './login.html';
      const isRegisterLink = href.endsWith('/register.html') || href.endsWith('./register.html') || href === './register.html';
      const isCreateIdLink = href.endsWith('/create-user-id.html') || href.endsWith('./create-user-id.html') || href === './create-user-id.html';
      const isAuthAction = isLoginLink || isRegisterLink || isCreateIdLink ||
        text === 'sign in' ||
        text === 'log in' ||
        text === 'open account' ||
        text === 'open an account' ||
        text.includes('create user id');

      if (token && isAuthAction) {
        const menuCard = link.classList.contains('zyraviq-menu-card');
        const footerLink = link.closest('.footer');
        const signInMenuLink = link.closest('.zyraviq-menu--signin');

        if (signInMenuLink || footerLink) {
          link.hidden = true;
          link.setAttribute('aria-hidden', 'true');
          return;
        }

        link.hidden = false;
        link.removeAttribute('aria-hidden');
        link.href = menuCard ? dashboard : profile;
        if (menuCard) {
          const title = link.querySelector('b');
          const desc = link.querySelector('span');
          if (isRegisterLink || text === 'open account' || text === 'open an account') {
            link.href = workspaceUrl('/profile');
            if (title) title.textContent = 'Profile';
            if (desc) desc.textContent = 'Manage your active account details.';
          } else if (isLoginLink || text === 'sign in' || text === 'log in') {
            link.href = workspaceUrl('/settings');
            if (title) title.textContent = 'Settings';
            if (desc) desc.textContent = 'Update alerts and workspace preferences.';
          } else {
            if (title) title.textContent = 'Dashboard';
            if (desc) desc.textContent = 'Continue to your active workspace.';
          }
        } else if (text === 'open account' || text === 'open an account' || text === 'sign in' || text === 'log in') {
          link.textContent = 'Dashboard';
        }
        return;
      }

      link.hidden = false;
      link.removeAttribute('aria-hidden');

      if (text === 'open account' || text === 'open an account') {
        link.href = pageUrl('register.html');
      }
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

  function initials(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  }

  function roleLabel(role) {
    if (role === 'warehouse_manager') return 'Warehouse manager';
    if (role === 'admin') return 'Admin';
    if (role === 'customer') return 'Customer';
    return role ? role.replace(/_/g, ' ') : 'User';
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

  function renderProfileIdentity(user = getStoredUser()) {
    document.querySelectorAll('[data-profile-identity]').forEach((identity) => {
      const token = localStorage.getItem('token');
      const displayName = user.name || user.email || (token ? 'User' : 'Login');
      const detail = [roleLabel(user.role || userRole()), user.companyName].filter(Boolean).join(' - ');
      const avatar = identity.querySelector('[data-profile-avatar]') || identity.querySelector('#adminAvatar') || document.getElementById('adminAvatar');
      const name = identity.querySelector('[data-profile-name]') || identity.querySelector('#adminName') || document.getElementById('adminName');
      const role = identity.querySelector('[data-profile-role]') || identity.querySelector('#adminRole') || document.getElementById('adminRole');

      identity.setAttribute('href', token ? pageUrl('profile.html') : pageUrl('login.html'));
      identity.setAttribute('title', token ? `Open ${displayName}'s profile` : 'Login or profile');
      if (avatar) avatar.textContent = initials(displayName) || 'U';
      if (name) name.textContent = displayName;
      if (role) role.textContent = detail || roleLabel(user.role || userRole());
    });
  }

  async function refreshProfileIdentity() {
    const token = localStorage.getItem('token');
    renderProfileIdentity();
    if (!token || !document.querySelector('[data-profile-identity]')) return;
    try {
      const response = await fetch(`${apiBase}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.user) {
        setStoredUser(data.user);
        renderProfileIdentity(data.user);
      }
    } catch {
      renderProfileIdentity();
    }
  }

  function ensureProfileAction() {
    const actions = document.querySelector('.zyraviq-actions');
    if (!actions) return;

    let link = actions.querySelector('[data-profile-action]');
    const installButton = actions.querySelector('.install-app-button');

    if (!link) {
      link = actions.querySelector('a[aria-label="Account"]');
    }

    if (!link) {
      link = document.createElement('a');
      link.className = 'zyraviq-icon-link profile-action-link';
      link.setAttribute('aria-label', 'Profile');
      link.setAttribute('data-profile-action', 'true');
      if (installButton?.nextSibling) {
        actions.insertBefore(link, installButton.nextSibling);
      } else {
        actions.appendChild(link);
      }
    }

    link.classList.add('profile-action-link');
    link.setAttribute('data-profile-action', 'true');

    const token = localStorage.getItem('token');
    const user = getStoredUser();
    const displayName = user.name || user.email || '';
    const userInitials = initials(displayName);
    const roleText = roleLabel(user.role || userRole());
    link.href = token ? pageUrl('profile.html') : pageUrl('login.html');
    link.title = token ? `Open ${displayName || 'your'} profile` : 'Login or profile';
    link.innerHTML = token && userInitials
      ? `<span class="profile-action-avatar" aria-hidden="true">${escapeHtml(userInitials)}</span><span class="profile-action-text"><strong>${escapeHtml(displayName || 'Profile')}</strong><small>${escapeHtml(roleText)}</small></span>`
      : '<span class="account-icon" aria-hidden="true"></span><span class="visually-hidden">Account</span>';
  }

  function enforceRoleVisibility() {
    const path = location.pathname.split('/').pop();
    const token = localStorage.getItem('token');
    const role = userRole();
    const isAdmin = isAdminRole(role);
    const adminOnlyPages = ['admin-dashboard.html', 'warehouses.html'];
    const protectedPages = ['customer-dashboard.html', 'admin-dashboard.html', 'warehouses.html', 'profile.html'];

    if (protectedPages.includes(path) && !token) {
      location.replace(pageUrl('login.html'));
      return;
    }

    if (adminOnlyPages.includes(path) && !isAdmin) {
      location.replace(token ? './customer-dashboard.html' : './login.html');
      return;
    }

    if (path === 'customer-dashboard.html' && token && isAdmin) {
      location.replace('./admin-dashboard.html');
      return;
    }

    document.querySelectorAll('a[href*="admin-dashboard.html"], a[href*="warehouses.html"]').forEach((link) => {
      if (!isAdmin) link.remove();
    });

    const dashboardLink = document.getElementById('dashboardNavLink');
    if (dashboardLink) {
      dashboardLink.href = pageUrl(isAdmin ? 'admin-dashboard.html' : 'customer-dashboard.html');
      dashboardLink.textContent = 'Dashboard';
    }

    ensureProfileAction();
    refreshProfileIdentity();
    enforceOpenAccountLinks();
    remapVisibleFeatureLinks();
    setupLanguageSelector();

    document.querySelectorAll('a').forEach((link) => {
      const text = (link.textContent || '').trim().toLowerCase();
      const href = link.getAttribute('href') || '';
      const isAccountLink = text === 'my profile' || link.getAttribute('aria-label') === 'Account';
      if (token && (isAccountLink || href.endsWith('/login.html') || href.endsWith('./login.html'))) {
        if (isAccountLink) link.textContent = text === 'my profile' ? 'My Profile' : link.textContent;
        link.href = pageUrl('profile.html');
      }
    });
  }

  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.style.display = 'none';
    }, 2400);
  }

  const themeIcon = themeToggle?.querySelector('.theme-icon') || themeToggle;

  function applyTheme(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.body.classList.toggle('theme-dark', nextTheme === 'dark');
    document.body.classList.toggle('theme-light', nextTheme === 'light');
    if (themeIcon) themeIcon.textContent = nextTheme === 'dark' ? 'Light' : 'Dark';
    if (themeToggle) themeToggle.title = nextTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }

  applyTheme(localStorage.getItem('theme') || (document.body.classList.contains('theme-dark') ? 'dark' : 'light'));
  enforceRoleVisibility();
  ensureProfileAction();
  refreshProfileIdentity();
  enforceOpenAccountLinks();
  remapVisibleFeatureLinks();
  setupLanguageSelector();

  function isStandaloneApp() {
    return window.matchMedia?.('(display-mode: standalone)').matches ||
      window.matchMedia?.('(display-mode: fullscreen)').matches ||
      window.navigator.standalone === true;
  }

  function setInstallButtonVisible(show) {
    if (!installAppButton) return;
    const visible = Boolean(show) && !isStandaloneApp();
    installAppButton.hidden = !visible;
    installAppButton.setAttribute('aria-disabled', visible ? 'false' : 'true');
  }

  setInstallButtonVisible(false);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const nextTheme = document.body.classList.contains('theme-dark') ? 'light' : 'dark';
      localStorage.setItem('theme', nextTheme);
      applyTheme(nextTheme);
    });
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register(new URL('service-worker.js', appRootUrl)).catch(() => {
        showToast('Install setup could not start. Please try again.');
      });
    });
  }

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    setInstallButtonVisible(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    setInstallButtonVisible(false);
    showToast('ZYRAVIQ AI app installed.');
  });

  window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', () => {
    setInstallButtonVisible(Boolean(deferredInstallPrompt));
  });
  window.addEventListener('pageshow', () => setInstallButtonVisible(Boolean(deferredInstallPrompt)));
  window.addEventListener('focus', () => setInstallButtonVisible(Boolean(deferredInstallPrompt)));

  function downloadAppShortcut() {
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      const link = document.createElement('a');
      link.href = new URL('download-app', appRootUrl).href;
      link.download = 'ZYRAVIQ AI Logistics.html';
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }

    const appUrl = new URL('app.html', appRootUrl).href;
    const launcher = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url=${appUrl}">
  <title>Open ZYRAVIQ AI Logistics</title>
</head>
<body>
  <p>Opening ZYRAVIQ AI Logistics...</p>
  <p><a href="${appUrl}">Open app</a></p>
</body>
</html>`;
    const blob = new Blob([launcher], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'ZYRAVIQ AI Logistics.html';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function installApp() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice.outcome === 'accepted') {
        setInstallButtonVisible(false);
        showToast('Installing ZYRAVIQ AI app...');
        return;
      }
      setInstallButtonVisible(false);
      return;
    }

    downloadAppShortcut();
    showToast('App launcher downloaded.');
  }

  installAppButton?.addEventListener('click', installApp);

  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  const trackingSearchForm = document.getElementById('trackingSearchForm');
  if (trackingSearchForm) {
    trackingSearchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const trackingNumber = document.getElementById('trackingNumber')?.value?.trim();
      if (!trackingNumber) return;
      location.href = `/tracking?tracking=${encodeURIComponent(trackingNumber)}`;
    });
  }

  const trackingMenuForm = document.getElementById('trackingMenuForm');
  if (trackingMenuForm) {
    trackingMenuForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const trackingNumber = document.getElementById('trackingMenuNumber')?.value?.trim();
      location.href = trackingNumber
        ? `/tracking?tracking=${encodeURIComponent(trackingNumber)}`
        : '/tracking';
    });
  }

  const openSearch = document.getElementById('openSearch');
  const closeSearch = document.getElementById('closeSearch');
  const searchOverlay = document.getElementById('searchOverlay');
  const chatbotToggle = document.getElementById('chatbotToggle');
  const chatbotWidget = document.getElementById('chatbotWidget');
  const chatbotClose = document.getElementById('chatbotClose');
  const chatbotForm = document.getElementById('chatbotForm');
  const headerSearchForm = document.getElementById('headerSearchForm');

  function toggleSearchOverlay(show) {
    if (!searchOverlay) return;
    searchOverlay.classList.toggle('active', show);
    searchOverlay.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  function toggleChatbot(show) {
    if (!chatbotWidget) return;
    chatbotWidget.classList.toggle('active', show);
    chatbotWidget.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  openSearch?.addEventListener('click', () => toggleSearchOverlay(true));
  closeSearch?.addEventListener('click', () => toggleSearchOverlay(false));
  chatbotToggle?.addEventListener('click', () => toggleChatbot(true));
  chatbotClose?.addEventListener('click', () => toggleChatbot(false));

  // Chatbot submission is handled by the universal chatbot script.
  if (chatbotForm) {
    // no-op
  }

  if (headerSearchForm) {
    headerSearchForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const query = document.getElementById('headerSearchInput')?.value?.trim();
      location.href = query
        ? `/tracking?search=${encodeURIComponent(query)}`
        : '/tracking';
    });
  }

  window.__showToast = showToast;
  window.__ZYRAVIQ_ROLE__ = { isAdminRole, roleHome, enforceRoleVisibility };
})();
