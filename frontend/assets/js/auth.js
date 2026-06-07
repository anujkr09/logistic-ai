/* Login/register form wiring */
(function () {
  const apiBase = window.__getApiBase?.() || window.API_BASE_URL || 'http://localhost:4000';

  function setToken(token) {
    if (token) localStorage.setItem('token', token);
  }

  function setUser(user) {
    if (!user) return;
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('userId', user.id || '');
    localStorage.setItem('userRole', user.role || '');
    localStorage.setItem('companyId', user.companyId || '');
  }

  function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userId');
    localStorage.removeItem('userRole');
    localStorage.removeItem('companyId');
  }

  function showToast(message) {
    window.__showToast?.(message);
  }

  function setFormBusy(form, busy, busyText) {
    const button = form?.querySelector('button[type="submit"]');
    if (!button) return;
    if (!button.dataset.defaultText) button.dataset.defaultText = button.textContent.trim();
    button.disabled = Boolean(busy);
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
    button.textContent = busy ? busyText : button.dataset.defaultText;
  }

  function dashboardFor(role) {
    return role === 'admin' || role === 'warehouse_manager'
      ? './admin-dashboard.html'
      : './customer-dashboard.html';
  }

  function syncCountryCode(select) {
    if (!select) return;
    const form = select.closest('form');
    const input = form?.elements.phoneCountryCode;
    const selected = select.selectedOptions?.[0];
    if (input && selected?.dataset.code) input.value = selected.dataset.code;
  }

  function redirectIfSignedIn() {
    const path = location.pathname.split('/').pop();
    const token = localStorage.getItem('token');
    if (!token || (path !== 'login.html' && path !== 'register.html')) return false;
    location.replace('./profile.html');
    return true;
  }

  function setupLoginForm() {
    const form = document.getElementById('loginForm');
    const hint = document.getElementById('authHint');
    const otpRequestForm = document.getElementById('otpRequestForm');
    const otpVerifyForm = document.getElementById('otpVerifyForm');
    const methodTabs = document.querySelectorAll('[data-auth-method]');
    let otpPayload = null;

    function setLoginMethod(method) {
      methodTabs.forEach((tab) => tab.classList.toggle('is-active', tab.dataset.authMethod === method));
      if (otpRequestForm) otpRequestForm.hidden = method !== 'otp' || Boolean(otpPayload);
      if (otpVerifyForm) otpVerifyForm.hidden = method !== 'otp' || !otpPayload;
      if (form) form.hidden = method !== 'password';
      if (hint) hint.textContent = '';
    }

    methodTabs.forEach((tab) => tab.addEventListener('click', () => {
      otpPayload = null;
      setLoginMethod(tab.dataset.authMethod || 'otp');
    }));

    otpRequestForm?.querySelectorAll('.auth-country').forEach((select) => {
      syncCountryCode(select);
      select.addEventListener('change', () => syncCountryCode(select));
    });

    async function requestOtp() {
      if (!otpRequestForm) return;
      const companyName = otpRequestForm.elements.companyName?.value?.trim();
      const phoneCountryCode = otpRequestForm.elements.phoneCountryCode?.value?.trim();
      const phoneNumber = otpRequestForm.elements.phoneNumber?.value?.trim();
      if (!companyName || !phoneCountryCode || !phoneNumber) {
        if (hint) hint.textContent = 'Company and mobile number required';
        return;
      }

      if (hint) {
        hint.textContent = 'Sending OTP...';
        hint.classList.add('is-loading');
      }
      setFormBusy(otpRequestForm, true, 'Sending OTP...');
      try {
        const response = await fetch(`${apiBase}/api/auth/login/request-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyName, phoneCountryCode, phoneNumber }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || 'Could not send OTP');
        otpPayload = { companyName, phoneCountryCode, phoneNumber };
        if (hint) {
          hint.textContent = data.demoOtp
            ? `Demo OTP: ${data.demoOtp}. Enter it to verify login.`
            : data.message || 'OTP sent. Please check your mobile.';
        }
        setLoginMethod('otp');
        otpVerifyForm?.elements.otp?.focus();
      } catch (error) {
        const offline = error?.message === 'Failed to fetch';
        if (hint) hint.textContent = offline ? 'Backend server is not running on port 4000' : error?.message || 'OTP request failed';
      } finally {
        setFormBusy(otpRequestForm, false);
        hint?.classList.remove('is-loading');
      }
    }

    otpRequestForm?.addEventListener('submit', (event) => {
      event.preventDefault();
      requestOtp();
    });

    otpVerifyForm?.querySelector('[data-action="resend-otp"]')?.addEventListener('click', requestOtp);

    otpVerifyForm?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const otp = otpVerifyForm.elements.otp?.value?.trim();
      if (!otpPayload || !otp) {
        if (hint) hint.textContent = 'Request OTP and enter the code';
        return;
      }

      if (hint) {
        hint.textContent = 'Verifying OTP...';
        hint.classList.add('is-loading');
      }
      setFormBusy(otpVerifyForm, true, 'Verifying...');
      try {
        const response = await fetch(`${apiBase}/api/auth/login/verify-otp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...otpPayload, otp }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || 'OTP verification failed');
        setToken(data.token);
        setUser(data.user);
        showToast('OTP verified');
        setTimeout(() => {
          location.href = dashboardFor(data.user?.role);
        }, 400);
      } catch (error) {
        const offline = error?.message === 'Failed to fetch';
        if (hint) hint.textContent = offline ? 'Backend server is not running on port 4000' : error?.message || 'OTP verification error';
      } finally {
        setFormBusy(otpVerifyForm, false);
        hint?.classList.remove('is-loading');
      }
    });

    if (!form) {
      setLoginMethod('otp');
      return;
    }

    setLoginMethod('otp');

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const companyName = form.elements.companyName?.value?.trim();
      const email = form.elements.email?.value?.trim();
      const password = form.elements.password?.value;

      if (!companyName || !email || !password) {
        if (hint) hint.textContent = 'Please fill all fields';
        return;
      }

      if (hint) {
        hint.textContent = 'Signing in...';
        hint.classList.add('is-loading');
      }
      setFormBusy(form, true, 'Signing in...');

      try {
        const response = await fetch(`${apiBase}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyName, email, password }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || 'Login failed');

        setToken(data.token);
        setUser(data.user);
        showToast('Login successful');
        setTimeout(() => {
          location.href = dashboardFor(data.user?.role);
        }, 400);
      } catch (error) {
        const offline = error?.message === 'Failed to fetch';
        if (hint) hint.textContent = offline ? 'Backend server is not running on port 4000' : error?.message || 'Login error';
      } finally {
        setFormBusy(form, false);
        hint?.classList.remove('is-loading');
      }
    });
  }

  function setupRegisterForm() {
    const form = document.getElementById('registerForm');
    if (!form) return;

    const hint = document.getElementById('authHint');
    const countrySelect = form.elements.phoneCountry;
    const countryCodeInput = form.elements.phoneCountryCode;
    const panInput = form.elements.panNumber;
    const gstInput = form.elements.gstNumber;

    function validateTaxFields() {
      if (!panInput || !gstInput || !hint) return true;
      const pan = (panInput.value || '').trim().toUpperCase();
      const gst = (gstInput.value || '').trim().toUpperCase();
      panInput.value = pan;
      gstInput.value = gst;

      if (!pan && !gst) {
        hint.textContent = '';
        return true;
      }

      if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan)) {
        hint.textContent = 'PAN format should be like ABCDE1234F';
        return false;
      }

      if (gst && gst.length === 15 && pan && gst.slice(2, 12) !== pan) {
        hint.textContent = 'GST number must contain the same PAN after the first 2 digits';
        return false;
      }

      if (gst && gst.length === 15 && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gst)) {
        hint.textContent = 'GST format should be like 07ABCDE1234F1Z5';
        return false;
      }

      hint.textContent = '';
      return true;
    }

    syncCountryCode(countrySelect);
    countrySelect?.addEventListener('change', () => syncCountryCode(countrySelect));
    panInput?.addEventListener('input', validateTaxFields);
    gstInput?.addEventListener('input', validateTaxFields);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const name = form.elements.name?.value?.trim();
      const email = form.elements.email?.value?.trim();
      const password = form.elements.password?.value;
      const companyName = form.elements.companyName?.value?.trim();
      const accountRole = form.elements.accountRole?.value || 'customer';
      const panNumber = form.elements.panNumber?.value?.trim().toUpperCase();
      const gstNumber = form.elements.gstNumber?.value?.trim().toUpperCase();
      const phoneCountry = form.elements.phoneCountry?.value?.trim();
      const phoneCountryCode = form.elements.phoneCountryCode?.value?.trim();
      const phoneNumber = form.elements.phoneNumber?.value?.trim();

      if (!name || !email || !password || !companyName || !accountRole || !panNumber || !gstNumber || !phoneCountry || !phoneCountryCode || !phoneNumber) {
        if (hint) hint.textContent = 'Please fill all fields';
        return;
      }

      if (!validateTaxFields()) return;

      if (password.length < 6) {
        if (hint) hint.textContent = 'Password must be at least 6 characters';
        return;
      }

      if (hint) {
        hint.textContent = 'Creating account...';
        hint.classList.add('is-loading');
      }
      setFormBusy(form, true, 'Creating account...');

      try {
        const response = await fetch(`${apiBase}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, companyName, accountRole, panNumber, gstNumber, phoneCountry, phoneCountryCode, phoneNumber }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || 'Registration failed');

        setToken(data.token);
        setUser(data.user);
        showToast('Account created successfully');
        setTimeout(() => {
          location.href = dashboardFor(data.user?.role);
        }, 400);
      } catch (error) {
        const offline = error?.message === 'Failed to fetch';
        if (hint) {
          hint.textContent = offline
            ? 'Backend server is not running on port 4000'
            : error?.message || 'Registration error';
        }
      } finally {
        setFormBusy(form, false);
        hint?.classList.remove('is-loading');
      }
    });
  }

  window.__AUTH__ = {
    clearAuth,
    logout() {
      clearAuth();
      location.href = './login.html';
    },
  };

  document.addEventListener('DOMContentLoaded', () => {
    if (redirectIfSignedIn()) return;
    setupLoginForm();
    setupRegisterForm();
  });
})();
