const authTokenKey = 'quantumtrade-auth-token';
let currentOtp = null;
let marketPrices = {};
let marketHistory = {};

function setAuthMessage(text, type = 'info') {
  const msg = document.getElementById('authMsg');
  if (!msg) return;
  msg.textContent = text;
  msg.className = `auth-msg ${type} visible`;
}

function clearAuthMessage() {
  const msg = document.getElementById('authMsg');
  if (!msg) return;
  msg.textContent = '';
  msg.className = 'auth-msg';
}

function showToast(message, positive = true) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.getElementById('toastIcon');
  if (!toast || !toastMsg || !toastIcon) return;
  toastMsg.textContent = message;
  toast.className = `toast show ${positive ? 'success' : 'error'}`;
  toastIcon.textContent = positive ? '✔' : '⚠';
  setTimeout(() => {
    if (toast) toast.className = 'toast';
  }, 3200);
}

function saveAuthToken(token) {
  if (token) {
    window.localStorage.setItem(authTokenKey, token);
  } else {
    window.localStorage.removeItem(authTokenKey);
  }
}

let googleClientId = '';

function getAuthHeaders() {
  const token = window.localStorage.getItem(authTokenKey);
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function initGoogleAuth() {
  try {
    const config = await fetchJson('/api/config');
    if (config.googleClientId) {
      googleClientId = config.googleClientId;
      await loadGoogleScript(config.googleClientId);
    }
  } catch (err) {
    console.warn('Google auth config not available:', err.message || err);
  }
}

function loadGoogleScript(clientId) {
  return new Promise((resolve) => {
    if (window.google?.accounts?.id) {
      return resolve();
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse,
      });
      resolve();
    };
    script.onerror = () => {
      console.warn('Unable to load Google Identity Services script.');
      resolve();
    };
    document.head.appendChild(script);
  });
}

async function handleGoogleCredentialResponse(response) {
  const token = response?.credential;
  if (!token) {
    setAuthMessage('Google sign-in failed.', 'error');
    return;
  }

  try {
    const result = await fetchJson('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken: token }),
    });

    saveAuthToken(result.token);
    if (result.user?.role === 'admin') {
      setAuthMessage('Admin login successful. Redirecting...', 'success');
      setTimeout(() => {
        window.location.href = '/admin';
      }, 700);
      return;
    }

    setAuthMessage('Signed in with Google.', 'success');
    await initializeApp();
  } catch (err) {
    setAuthMessage(err.message || 'Google sign-in failed.', 'error');
  }
}

function openGoogleLogin() {
  if (!googleClientId || !window.google?.accounts?.id) {
    setAuthMessage('Google login is not configured on this server.', 'error');
    return;
  }
  window.google.accounts.id.prompt();
}

function switchTab(tabName) {
  document.querySelectorAll('.auth-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.tab === tabName);
  });

  const signInSection = document.getElementById('siEmail');
  const signUpSection = document.getElementById('suEmailSection');
  if (signInSection && signUpSection) {
    signInSection.classList.toggle('hidden', tabName === 'signup');
    signUpSection.classList.toggle('hidden', tabName !== 'signup');
  }

  if (tabName === 'signup') {
    switchMethod('email');
  }

  clearAuthMessage();
}

function switchMethod(method) {
  document.querySelectorAll('.method-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.method === method);
  });
  document.querySelectorAll('.auth-form-body').forEach((panel) => {
    panel.classList.toggle('visible', panel.id === `form${method.charAt(0).toUpperCase() + method.slice(1)}`);
  });
  clearAuthMessage();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), ...getAuthHeaders() },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || data.message || response.statusText || 'Request failed');
  }
  return data;
}

async function postAuth(endpoint, payload) {
  try {
    const result = await fetchJson(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    saveAuthToken(result.token);
    const isAdmin = result.user?.role === 'admin';
    if (isAdmin) {
      setAuthMessage('Authentication successful. Redirecting to admin dashboard...', 'success');
      showToast('Signed in successfully.', true);
      setTimeout(() => {
        window.location.href = '/admin';
      }, 700);
    } else {
      setAuthMessage('Authentication successful. You are signed in.', 'success');
      showToast('Signed in successfully.', true);
      await initializeApp();
    }
    return result;
  } catch (error) {
    setAuthMessage(error.message, 'error');
    showToast(error.message, false);
    throw error;
  }
}

function validateEmail(value) {
  return value && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

async function handleSignIn() {
  const username = document.getElementById('siUsername').value.trim();
  const password = document.getElementById('siPassword').value;
  if (!username || !password) {
    setAuthMessage('Please enter username and password.', 'error');
    return;
  }
  await postAuth('/api/auth/login', { username, password });
}

async function handleSignUp() {
  const username = document.getElementById('suUsername').value.trim();
  const email = document.getElementById('suEmail').value.trim();
  const phone = document.getElementById('suPhone')?.value.trim() || '';
  const password = document.getElementById('suPassword').value;
  if (!username || !password) {
    setAuthMessage('Username and password are required.', 'error');
    return;
  }
  if (email && !validateEmail(email)) {
    setAuthMessage('Enter a valid email address or leave it blank.', 'error');
    return;
  }
  await postAuth('/api/auth/register', { username, password, email, phone });
}

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function handleSendOtp() {
  const phone = document.getElementById('phoneInput').value.trim();
  if (!phone) {
    setAuthMessage('Enter your mobile number to receive an OTP.', 'error');
    return;
  }
  currentOtp = generateOtp();
  document.getElementById('otpCode').textContent = currentOtp;
  document.getElementById('otpVerifySection')?.classList.remove('hidden');
  setAuthMessage('OTP generated. Enter it below to verify.', 'success');
}

function handleVerifyOtp() {
  const entered = document.getElementById('otpInput').value.trim();
  if (!entered) {
    setAuthMessage('Please enter the OTP.', 'error');
    return;
  }
  if (entered !== currentOtp) {
    setAuthMessage('OTP does not match. Try again.', 'error');
    return;
  }
  setAuthMessage('Phone verified successfully. You can now complete sign in.', 'success');
  showToast('Phone OTP verified.', true);
}

function drawSparkline(canvas, values) {
  if (!canvas || !canvas.getContext || !Array.isArray(values) || values.length < 2) return;
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = index * step;
    const y = height - ((value - min) / range) * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function renderMarket(data) {
  const stockSelect = document.getElementById('stock-select');
  const marketRows = document.getElementById('live-market-rows');
  if (!stockSelect || !marketRows) return;
  const prices = data.prices || {};
  const history = data.history || {};
  marketPrices = prices;
  marketHistory = history;

  stockSelect.innerHTML = Object.keys(prices)
    .map((symbol) => `<option value="${symbol}">${symbol}</option>`)
    .join('');

  marketRows.innerHTML = Object.entries(prices)
    .map(([symbol, value]) => {
      return `
        <div class="market-row">
          <div class="asset-meta">
            <strong>${symbol}</strong>
            <span>${marketHistory[symbol] ? `${marketHistory[symbol].length} periods` : 'Live update'}</span>
          </div>
          <span>$${Number(value).toFixed(2)}</span>
          <button class="btn btn-ghost" type="button">View</button>
        </div>`;
    })
    .join('');
}

async function loadMarket() {
  try {
    const result = await fetchJson('/market');
    renderMarket(result);
  } catch (error) {
    setAuthMessage('Unable to load market data.', 'error');
  }
}

function renderPortfolio(account) {
  const portfolioRows = document.getElementById('portfolio-rows');
  if (!portfolioRows) return;
  const holdings = account.holdings || {};
  const entries = Object.entries(holdings);
  if (!entries.length) {
    portfolioRows.innerHTML = '<div class="empty-state">No holdings yet. Buy a stock to see it here.</div>';
    return;
  }

  portfolioRows.innerHTML = entries
    .map(([symbol, qty]) => {
      const value = Number((Number(qty) * Number(marketPrices[symbol] || 0)).toFixed(2));
      const pnl = 0.0;
      return `
        <div class="portfolio-row">
          <strong>${symbol}</strong>
          <span>${Number(qty).toFixed(2)}</span>
          <span>$0.00</span>
          <span class="${pnl >= 0 ? 'positive' : 'negative'}">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</span>
          <span>$${value.toFixed(2)}</span>
        </div>`;
    })
    .join('');
}

async function loadAccount() {
  try {
    const account = await fetchJson('/api/users/me');
    document.getElementById('account-username').textContent = `${account.username || 'Trader'}`;
    document.getElementById('account-email').textContent = account.email || 'No email provided';
    document.getElementById('account-cash').textContent = `$${Number(account.cash).toFixed(2)}`;
    document.getElementById('account-pnl').textContent = `$${Number(account.pnl).toFixed(2)}`;
    document.getElementById('sidebar-cash').textContent = `$${Number(account.cash).toFixed(2)}`;
    document.getElementById('sidebar-pnl').textContent = `$${Number(account.pnl).toFixed(2)}`;
    document.getElementById('sidebar-networth').textContent = `$${Number(account.cash + (account.portfolio?.totalValue || 0)).toFixed(2)}`;
    renderPortfolio(account);
  } catch (error) {
    setAuthMessage('Unable to load account details. Please log in again.', 'error');
    saveAuthToken(null);
    updateAuthUI();
  }
}

async function loadPromoCodes() {
  const promoListEl = document.getElementById('promo-list');
  if (!promoListEl) return;
  try {
    const promos = await fetchJson('/api/promos');
    promoListEl.innerHTML = promos.length
      ? `<div style="display:grid;gap:10px;max-height:220px;overflow:auto;">${promos
          .map((promo) => `<div style="background:#f8fafc;padding:12px;border-radius:12px;display:flex;justify-content:space-between;align-items:center;"><span>${promo.code} — $${Number(promo.amount).toFixed(2)} (${promo.active ? 'Active' : 'Inactive'})</span><button class="btn btn-ghost" type="button" onclick="document.getElementById('promo-input').value='${promo.code}'">Use</button></div>`)
          .join('')}</div>`
      : '<div class="empty-state">No promo codes available.</div>';
  } catch (error) {
    promoListEl.innerHTML = '<div class="empty-state">Unable to load promo codes.</div>';
  }
}

async function redeemPromo() {
  const promoInput = document.getElementById('promo-input');
  if (!promoInput) return;
  const code = promoInput.value.trim();
  if (!code) {
    setAuthMessage('Enter a promo code before redeeming.', 'error');
    return;
  }

  try {
    const result = await fetchJson('/api/promos/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    setAuthMessage(`Promo redeemed: $${Number(result.amount).toFixed(2)} added to your balance.`, 'success');
    promoInput.value = '';
    await Promise.all([loadAccount(), loadPromoCodes()]);
  } catch (error) {
    setAuthMessage(error.message, 'error');
  }
}

async function tradeStock(action) {
  const stockSelect = document.getElementById('stock-select');
  const quantityInput = document.getElementById('trade-quantity');
  if (!stockSelect || !quantityInput) return;
  const symbol = stockSelect.value;
  const quantity = Number(quantityInput.value);
  if (!symbol || !quantity || quantity <= 0) {
    setAuthMessage('Choose a stock and enter a valid quantity.', 'error');
    return;
  }

  try {
    const endpoint = action === 'sell' ? '/api/trade/sell' : '/api/trade/buy';
    const result = await fetchJson(endpoint, {
      method: 'POST',
      body: JSON.stringify({ symbol, quantity }),
    });
    setAuthMessage(result.message, 'success');
    quantityInput.value = '1';
    await Promise.all([loadAccount(), loadMarket()]);
  } catch (error) {
    setAuthMessage(error.message, 'error');
  }
}

async function showUserPanel(panelId) {
  document.querySelectorAll('.user-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== panelId);
  });
  document.querySelectorAll('.user-nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.target === panelId);
  });
}

async function initializeApp() {
  updateAuthUI();
  await Promise.all([loadAccount(), loadMarket(), loadPromoCodes()]);
  showUserPanel('panel-overview');
}

async function socialAuth(provider) {
  try {
    const result = await fetchJson(`/auth/${provider}`);
    setAuthMessage(result.message || 'Social auth response received.', 'info');
  } catch (error) {
    setAuthMessage(error.message, 'error');
  }
}

function work() {
  document.getElementById('tabSignin').addEventListener('click', () => switchTab('signin'));
  document.getElementById('tabSignup').addEventListener('click', () => switchTab('signup'));

  const pillEmail = document.getElementById('pillEmail');
  const pillPhone = document.getElementById('pillPhone');
  const pillSocial = document.getElementById('pillSocial');
  if (pillEmail) pillEmail.addEventListener('click', () => switchMethod('email'));
  if (pillPhone) pillPhone.addEventListener('click', () => switchMethod('phone'));
  if (pillSocial) pillSocial.addEventListener('click', () => switchMethod('social'));

  const btnSignIn = document.getElementById('btnSignIn');
  const btnSignUp = document.getElementById('btnSignUp');
  const btnSendOtp = document.getElementById('btnSendOtp');
  const btnVerifyOtp = document.getElementById('btnVerifyOtp');
  const btnFacebook = document.getElementById('btnFacebook');

  if (btnSignIn) btnSignIn.addEventListener('click', handleSignIn);
  if (btnSignUp) btnSignUp.addEventListener('click', handleSignUp);
  if (btnSendOtp) btnSendOtp.addEventListener('click', handleSendOtp);
  if (btnVerifyOtp) btnVerifyOtp.addEventListener('click', handleVerifyOtp);
  if (btnFacebook) btnFacebook.addEventListener('click', () => socialAuth('stocks'));
  const btnGoogleAuth = document.getElementById('btnGoogleAuth');
  if (btnGoogleAuth) btnGoogleAuth.addEventListener('click', openGoogleLogin);

  const redeemButton = document.getElementById('redeem-button');
  const buyButton = document.getElementById('buy-button');
  const sellButton = document.getElementById('sell-button');
  const stockSelect = document.getElementById('stock-select');
  const logoutButton = document.getElementById('logout-button');

  if (redeemButton) redeemButton.addEventListener('click', redeemPromo);
  if (buyButton) buyButton.addEventListener('click', () => tradeStock('buy'));
  if (sellButton) sellButton.addEventListener('click', () => tradeStock('sell'));
  if (stockSelect) stockSelect.addEventListener('change', () => {});
  if (logoutButton) logoutButton.addEventListener('click', logout);

  document.querySelectorAll('.user-nav-link').forEach((link) => {
    link.addEventListener('click', () => showUserPanel(link.dataset.target));
  });

  switchTab('signin');
  switchMethod('email');
  initGoogleAuth().catch(() => {});
  if (localStorage.getItem(authTokenKey)) {
    initializeApp();
  }
}

window.work = work;
window.addEventListener('DOMContentLoaded', work);