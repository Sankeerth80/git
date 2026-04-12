const authTokenKey = 'quantumtrade-token';
const state = { token: localStorage.getItem(authTokenKey) || null };
const pageType = document.body?.dataset.page || 'admin';
let marketPrices = {};
let marketHistory = {};

function setMessage(text, type = 'info') {
  const messageEl = document.getElementById('message');
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  return headers;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: { ...(options.headers || {}), ...getAuthHeaders() },
  });
  if (!response.ok) {
    const text = await response.text();
    let errorMessage = response.statusText;
    try {
      const json = JSON.parse(text);
      errorMessage = json.error || json.message || errorMessage;
    } catch (err) {
      errorMessage = text || errorMessage;
    }
    throw new Error(errorMessage || `HTTP ${response.status}`);
  }
  return response.json();
}

function saveToken(token) {
  state.token = token;
  if (token) {
    localStorage.setItem(authTokenKey, token);
  } else {
    localStorage.removeItem(authTokenKey);
  }
}

function showPanel(panelId) {
  document.querySelectorAll('.panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== panelId);
  });
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.target === panelId);
  });
}

function setSidebarProfile(profile) {
  const sidebarUser = document.getElementById('sidebar-user');
  if (sidebarUser) sidebarUser.textContent = profile.username;
  const networth = document.getElementById('sidebar-networth');
  const cash = document.getElementById('sidebar-cash');
  const pnl = document.getElementById('sidebar-pnl');
  const profileUsername = document.getElementById('profile-username');
  const profileRole = document.getElementById('profile-role');
  const profileCash = document.getElementById('profile-cash');
  const profilePnl = document.getElementById('profile-pnl');
  if (sidebarUser) sidebarUser.textContent = profile.username;
  if (networth) networth.textContent = `$${Number(profile.cash + (profile.pnl || 0)).toFixed(2)}`;
  if (cash) cash.textContent = `$${Number(profile.cash).toFixed(2)}`;
  if (pnl) pnl.textContent = `$${Number(profile.pnl).toFixed(2)}`;
  if (profileUsername) profileUsername.textContent = profile.username;
  if (profileRole) profileRole.textContent = profile.role;
  if (profileCash) profileCash.textContent = Number(profile.cash).toFixed(2);
  if (profilePnl) profilePnl.textContent = Number(profile.pnl).toFixed(2);
}

function renderPortfolio(profile) {
  const container = document.getElementById('portfolio-summary');
  if (!container) return;
  const holdings = profile.holdings || {};
  const entries = Object.entries(holdings);
  if (!entries.length) {
    const profileHoldings = document.getElementById('profile-holdings');
    if (profileHoldings) {
      profileHoldings.textContent = '{}';
    }
    container.innerHTML = '<div class="empty-state">No positions in the portfolio yet.</div>';
    return;
  }

  const holdingsDisplay = Object.entries(holdings)
    .map(([asset, qty]) => `${asset}: ${Number(qty).toFixed(2)}`)
    .join('\n');
  const profileHoldings = document.getElementById('profile-holdings');
  if (profileHoldings) {
    profileHoldings.textContent = holdingsDisplay || '{}';
  }

  container.innerHTML = `
    <table class="admin-table small-table">
      <thead><tr><th>Asset</th><th>Qty</th><th>Avg Cost</th><th>PnL</th><th>Value</th></tr></thead>
      <tbody>
        ${entries
          .map(
            ([asset, qty]) => `
            <tr>
              <td>${asset}</td>
              <td>${Number(qty).toFixed(2)}</td>
              <td>$0.00</td>
              <td class="positive">+$0.00</td>
              <td>$${Number(qty * 0).toFixed(2)}</td>
            </tr>`
          )
          .join('')}
      </tbody>
    </table>`;
}

function setStockMax() {
  const stockSelect = document.getElementById('stock-select');
  const quantityInput = document.querySelector('#purchase-form [name=quantity]');
  if (!stockSelect || !quantityInput || !marketPrices) return;
  const stock = stockSelect.value;
  const price = Number(marketPrices[stock] || 0);
  const cashDisplay = document.getElementById('profile-cash');
  if (!price || !cashDisplay) return;
  const cash = Number(cashDisplay.textContent.replace(/[^0-9.-]+/g, '') || 0);
  const maxQty = Math.floor(cash / price);
  quantityInput.value = String(maxQty > 0 ? maxQty : 1);
}

async function purchaseStock(event) {
  event.preventDefault();
  const stockSelect = document.getElementById('stock-select');
  const quantityInput = document.querySelector('#purchase-form [name=quantity]');
  if (!stockSelect || !quantityInput) return;

  const stock = stockSelect.value;
  const quantity = Number(quantityInput.value);
  const price = Number(marketPrices[stock] || 0);
  if (!stock || !quantity || quantity <= 0) {
    setMessage('Enter a valid stock and quantity.', 'error');
    return;
  }
  if (!price) {
    setMessage('Market price unavailable. Please wait.', 'error');
    return;
  }

  const cashDisplay = document.getElementById('profile-cash');
  if (!cashDisplay) return;
  const currentCash = Number(cashDisplay.textContent.replace(/[^0-9.-]+/g, '') || 0);
  const totalCost = quantity * price;
  if (totalCost > currentCash) {
    setMessage('Not enough cash to complete this purchase.', 'error');
    return;
  }

  const holdingsElement = document.getElementById('profile-holdings');
  const currentHoldings = holdingsElement ? JSON.parse(holdingsElement.textContent || '{}') : {};
  currentHoldings[stock] = (currentHoldings[stock] || 0) + quantity;
  if (holdingsElement) {
    holdingsElement.textContent = JSON.stringify(currentHoldings, null, 2);
  }
  if (cashDisplay) {
    cashDisplay.textContent = Number(currentCash - totalCost).toFixed(2);
  }

  setMessage(`Bought ${quantity} ${stock} for $${totalCost.toFixed(2)}.`, 'success');
  quantityInput.value = '1';
}

function copyPromoCode(code) {
  if (!code) return;
  navigator.clipboard
    .writeText(code)
    .then(() => setMessage(`Promo code ${code} copied to clipboard.`, 'success'))
    .catch(() => setMessage('Unable to copy promo code.', 'error'));
}

async function handleAuth(event, mode) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  const url = mode === 'register' ? '/api/register' : '/api/login';

  try {
    const result = await fetchJson(url, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    saveToken(result.token);
    updateAuthUI();
    await loadProfile();
  } catch (err) {
    setMessage(err.message, 'error');
  }
}

async function startOAuth(provider) {
  try {
    const result = await fetchJson(`/auth/${provider}`);
    if (result.redirectTo) {
      window.location.href = result.redirectTo;
      return;
    }
    setMessage(result.message || `OAuth support is not ready for ${provider}.`, 'info');
  } catch (err) {
    setMessage(`OAuth cannot start: ${err.message}`, 'error');
  }
}

function logout() {
  saveToken(null);
  setMessage('Logged out successfully. Use the form to sign in again.', 'info');
  updateAuthUI();
}

function updateAuthUI() {
  const loggedIn = Boolean(state.token);
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');
  const logoutButton = document.getElementById('logout-button');
  if (loginView && appView) {
    loginView.classList.toggle('hidden', loggedIn);
    appView.classList.toggle('hidden', !loggedIn);
  }
  if (logoutButton) logoutButton.classList.toggle('hidden', !loggedIn);
}

async function loadProfile() {
  if (!state.token) {
    return;
  }
  try {
    const profile = await fetchJson('/api/me');
    setSidebarProfile(profile);
    renderPortfolio(profile);

    if (pageType === 'admin') {
      if (profile.role !== 'admin') {
        setMessage('Admin access is required to use this page.', 'error');
        updateAuthUI();
        return;
      }
      updateAuthUI();
      showPanel('dashboard-panel');
      await loadAdminUsers();
      await loadPromoCodes();
      await loadHealthStatus();
      await loadCurrentTrend();
    } else {
      updateAuthUI();
      await loadPromoCodes();
      await loadCurrentTrend();
    }

    setMessage('Logged in as ' + profile.username, 'success');
  } catch (error) {
    setMessage('Session expired. Please log in again.', 'error');
    saveToken(null);
    updateAuthUI();
  }
}

async function loadAdminUsers() {
  const usersList = document.getElementById('users-list');
  if (!usersList) return;

  try {
    const users = await fetchJson('/api/users');
    usersList.innerHTML = users
      .map(
        (user) => `
        <tr>
          <td>${user.username}</td>
          <td>${user.role}</td>
          <td>$${Number(user.cash).toFixed(2)}</td>
          <td><pre>${JSON.stringify(user.holdings || {})}</pre></td>
          <td>$${Number(user.pnl).toFixed(2)}</td>
        </tr>`
      )
      .join('');
  } catch (err) {
    usersList.innerHTML = '<tr><td colspan="5">Unable to load users.</td></tr>';
  }
}

async function loadPromoCodes() {
  const promoList = document.getElementById('promo-list');
  if (!promoList) return;

  try {
    const promos = await fetchJson('/api/promos');
    promoList.innerHTML = promos
      .map(
        (promo) => `
        <tr>
          <td>${promo.code}</td>
          <td>${promo.discountPercent}%</td>
          <td>${promo.maxUses}</td>
          <td>${promo.usedCount}</td>
          <td>${promo.active ? 'Yes' : 'No'}</td>
          <td><button type="button" class="copy-promo-button" data-code="${promo.code}">Copy</button></td>
        </tr>`
      )
      .join('');
  } catch (err) {
    promoList.innerHTML = '<tr><td colspan="5">Unable to load promo codes.</td></tr>';
  }
}

async function loadHealthStatus() {
  const status = document.getElementById('health-status');
  const dbStatus = document.getElementById('health-db');
  const time = document.getElementById('health-time');
  if (!status || !dbStatus || !time) return;

  try {
    const result = await fetchJson('/health');
    status.textContent = result.status;
    dbStatus.textContent = result.db;
    time.textContent = new Date().toLocaleTimeString();
  } catch (err) {
    status.textContent = 'Error';
    dbStatus.textContent = 'Unknown';
    time.textContent = new Date().toLocaleTimeString();
  }
}

async function loadCurrentTrend() {
  const trend = document.getElementById('market-trend');
  if (!trend) return;

  try {
    const data = await fetchJson('/api/market-trend');
    trend.textContent = data.trend.toUpperCase();
  } catch (_) {
    trend.textContent = 'NORMAL';
  }
}

async function createPromo(event) {
  event.preventDefault();
  const form = event.target;
  const code = form.querySelector('[name=code]').value.trim();
  const discountPercent = Number(form.querySelector('[name=discountPercent]').value);
  const maxUses = Number(form.querySelector('[name=maxUses]').value);

  if (!code || !discountPercent || !maxUses) {
    setMessage('Code, discount percent, and max uses are required.', 'error');
    return;
  }

  try {
    await fetchJson('/api/promos', {
      method: 'POST',
      body: JSON.stringify({ code, discountPercent, maxUses }),
    });
    setMessage('Promo code created successfully.', 'success');
    form.reset();
    await loadPromoCodes();
  } catch (err) {
    setMessage(err.message, 'error');
  }
}

async function redeemPromo() {
  const promoInput = document.getElementById('promo-input');
  if (!promoInput) return;
  const code = promoInput.value.trim();
  if (!code) {
    setMessage('Enter a promo code before redeeming.', 'error');
    return;
  }

  try {
    const result = await fetchJson('/api/promos/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    setMessage(`Promo redeemed: ${result.discountPercent}% off. ${result.remainingUses} uses left.`, 'success');
    promoInput.value = '';
    await loadPromoCodes();
  } catch (err) {
    setMessage(err.message, 'error');
  }
}

async function setMarketTrend(trend) {
  try {
    await fetchJson('/api/market-trend', {
      method: 'POST',
      body: JSON.stringify({ trend }),
    });
    await loadCurrentTrend();
    setMessage(`Market trend changed to ${trend.toUpperCase()}.`, 'success');
  } catch (err) {
    setMessage(err.message, 'error');
  }
}

function drawSparkline(canvas, values) {
  if (!canvas || !canvas.getContext || !Array.isArray(values) || values.length < 2) return;
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const margin = 8;
  ctx.clearRect(0, 0, width, height);

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = (width - margin * 2) / (values.length - 1);

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = margin + index * step;
    const y = height - margin - ((value - min) / range) * (height - margin * 2);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  const start = values[0];
  const end = values[values.length - 1];
  const lineColor = end >= start ? '#34d399' : '#f472b6';
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = margin + index * step;
    const y = height - margin - ((value - min) / range) * (height - margin * 2);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

function drawAllSparklines(historyData) {
  if (!historyData) return;
  Object.entries(historyData).forEach(([symbol, values]) => {
    const canvas = document.getElementById(`sparkline-${symbol}`);
    if (canvas) drawSparkline(canvas, values);
  });
}

function renderMarket(prices, historyData) {
  const pricesEl = document.getElementById('prices');
  if (!pricesEl) return;
  pricesEl.innerHTML = Object.entries(prices)
    .map(([name, val]) => {
      const itemHistory = historyData?.[name] || Array(12).fill(val);
      const first = itemHistory[0] || val;
      const changePct = first ? ((val - first) / first) * 100 : 0;
      const changeClass = changePct >= 0 ? 'price-positive' : 'price-negative';
      const changeArrow = changePct >= 0 ? '▲' : '▼';
      const high = Math.max(...itemHistory).toFixed(2);
      const low = Math.min(...itemHistory).toFixed(2);
      return `
      <div class="market-card stock-card">
        <div class="stock-card-header">
          <span class="stock-name">${name}</span>
          <span class="price">$${Number(val).toFixed(2)}</span>
        </div>
        <div class="stock-card-details ${changeClass}">${changeArrow} ${Math.abs(changePct).toFixed(2)}%</div>
        <canvas id="sparkline-${name}" width="280" height="90"></canvas>
        <div class="stock-card-footer">High: $${high} · Low: $${low}</div>
      </div>`;
    })
    .join('');

  setTimeout(() => drawAllSparklines(historyData), 0);
}

async function updateMarket() {
  try {
    const data = await fetchJson('/market');
    marketPrices = data.prices || {};
    marketHistory = data.history || {};
    renderMarket(marketPrices, marketHistory);
  } catch (err) {
    const pricesEl = document.getElementById('prices');
    if (pricesEl) {
      pricesEl.textContent = 'Market data unavailable';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-form').addEventListener('submit', (event) => handleAuth(event, 'login'));
  document.getElementById('register-form').addEventListener('submit', (event) => handleAuth(event, 'register'));
  document.getElementById('logout-button').addEventListener('click', logout);

  const promoForm = document.getElementById('promo-form');
  if (promoForm) {
    promoForm.addEventListener('submit', createPromo);
  }

  const redeemButton = document.getElementById('redeem-promo');
  if (redeemButton) {
    redeemButton.addEventListener('click', redeemPromo);
  }

  document.getElementById('google-login')?.addEventListener('click', () => startOAuth('google'));
  document.getElementById('microsoft-login')?.addEventListener('click', () => startOAuth('microsoft'));

  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => showPanel(link.dataset.target));
  });

  document.querySelectorAll('.trend-button').forEach((button) => {
    button.addEventListener('click', () => setMarketTrend(button.dataset.trend));
  });

  document.getElementById('stock-max-button')?.addEventListener('click', setStockMax);
  document.getElementById('purchase-form')?.addEventListener('submit', purchaseStock);
  document.getElementById('promo-list')?.addEventListener('click', (event) => {
    const button = event.target.closest('.copy-promo-button');
    if (button) {
      copyPromoCode(button.dataset.code);
    }
  });

  updateAuthUI();
  if (state.token) {
    loadProfile();
  }
  updateMarket();
  setInterval(updateMarket, 3000);
});
