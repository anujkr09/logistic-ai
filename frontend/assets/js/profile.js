/* Shared profile page for customer and admin accounts */
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

  function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('companyId');
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
    localStorage.setItem('userId', user.id || '');
    localStorage.setItem('userRole', user.role || '');
    localStorage.setItem('companyId', user.companyId || '');
  }

  function isAdmin(user = getStoredUser()) {
    return user.role === 'admin' || user.role === 'warehouse_manager';
  }

  function dashboardHref(user = getStoredUser()) {
    return isAdmin(user) ? './admin-dashboard.html' : './customer-dashboard.html';
  }

  function roleLabel(user = getStoredUser()) {
    if (user.role === 'warehouse_manager') return 'Warehouse Manager';
    return isAdmin(user) ? 'Admin' : 'Customer';
  }

  function formatPhone(phone = {}) {
    if (phone.fullNumber) return phone.fullNumber;
    return [phone.countryCode, phone.number].filter(Boolean).join(' ') || '-';
  }

  function initials(name, fallback = 'SX') {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return fallback;
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value || '-';
  }

  function optionCodeForCountry(country) {
    const select = document.getElementById('editPhoneCountry');
    const option = [...(select?.options || [])].find((item) => item.value === country);
    return option?.dataset.code || '+91';
  }

  function fillEditForm(user = getStoredUser()) {
    const phone = user.phone || {};
    const email = document.getElementById('editEmail');
    const country = document.getElementById('editPhoneCountry');
    const code = document.getElementById('editPhoneCode');
    const number = document.getElementById('editPhoneNumber');

    if (email) email.value = user.email || '';
    if (country) country.value = phone.country || 'India';
    if (code) code.value = phone.countryCode || optionCodeForCountry(country?.value || 'India');
    if (number) number.value = phone.number || '';
  }

  function renderNav(user) {
    const nav = document.getElementById('profileNav');
    if (!nav) return;

    const links = isAdmin(user)
      ? [
          ['Dashboard', './admin-dashboard.html'],
          ['Profile', './profile.html'],
          ['Warehouses', './warehouses.html'],
          ['Track', './tracking.html'],
        ]
      : [
          ['Dashboard', './customer-dashboard.html'],
          ['Profile', './profile.html'],
          ['Track Shipment', './tracking.html'],
        ];

    nav.innerHTML = links
      .map(([label, href]) => `<a class="side-link ${href.endsWith('profile.html') ? 'active' : ''}" href="${href}">${label}</a>`)
      .join('');
  }

  function renderProfile(user = getStoredUser()) {
    const label = roleLabel(user);
    const phone = user.phone || {};
    const dashboard = document.getElementById('profileDashboardLink');
    if (dashboard) dashboard.href = dashboardHref(user);

    renderNav(user);
    setText('profileSideRole', label);
    setText('profileSideName', user.name || 'Your account');
    setText('profileRole', label);
    setText('profileNameTitle', user.name);
    setText('profileEmailTitle', user.email);
    setText('profileAvatar', initials(user.name));
    setText('profileName', user.name);
    setText('profileEmail', user.email);
    setText('profilePhone', formatPhone(phone));
    setText('profileCountry', phone.country);
    setText('profileCompany', user.companyName);
    setText('profilePan', user.panNumber);
    setText('profileGst', user.gstNumber);
    setText('profileAccountType', label);
    fillEditForm(user);
  }

  async function fetchProfile() {
    const response = await fetch(`${apiBase}/api/auth/me`, { headers: authHeaders() });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || 'Profile could not load');
    return data.user;
  }

  async function updateProfile(payload) {
    const response = await fetch(`${apiBase}/api/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || 'Profile update failed');
    return data.user;
  }

  function setupEditForm() {
    const form = document.getElementById('profileEditForm');
    const country = document.getElementById('editPhoneCountry');
    const code = document.getElementById('editPhoneCode');
    const reset = document.getElementById('profileResetBtn');
    const state = document.getElementById('profileSaveState');
    const button = document.getElementById('profileSaveBtn');
    if (!form) return;

    country?.addEventListener('change', () => {
      if (code) code.value = country.selectedOptions?.[0]?.dataset.code || '+91';
    });

    reset?.addEventListener('click', () => {
      fillEditForm();
      if (state) state.textContent = '';
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const email = form.elements.email?.value?.trim();
      const phoneCountry = form.elements.phoneCountry?.value?.trim();
      const phoneCountryCode = form.elements.phoneCountryCode?.value?.trim();
      const phoneNumber = form.elements.phoneNumber?.value?.trim();

      if (!email || !phoneCountry || !phoneCountryCode || !phoneNumber) {
        if (state) state.textContent = 'Please fill email and mobile number';
        return;
      }

      if (state) state.textContent = 'Saving...';
      if (button) button.disabled = true;

      try {
        const user = await updateProfile({ email, phoneCountry, phoneCountryCode, phoneNumber });
        setStoredUser(user);
        renderProfile(user);
        if (state) state.textContent = 'Saved';
        showToast('Profile updated');
      } catch (error) {
        if (state) state.textContent = error.message;
      } finally {
        if (button) button.disabled = false;
      }
    });
  }

  async function init() {
    if (!getToken()) {
      location.replace('./login.html');
      return;
    }

    renderProfile();
    setupEditForm();

    try {
      const user = await fetchProfile();
      setStoredUser(user);
      renderProfile(user);
    } catch (error) {
      if (/missing token|invalid token/i.test(error.message)) {
        clearAuth();
        location.replace('./login.html');
        return;
      }
      showToast(error.message);
    }
  }

  document.getElementById('logoutBtn')?.addEventListener('click', () => {
    clearAuth();
    location.href = './login.html';
  });

  document.addEventListener('DOMContentLoaded', init);
})();
