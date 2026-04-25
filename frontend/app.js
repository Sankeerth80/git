const authTokenKey = 'quantumtrade-token';
const state = { token: localStorage.getItem(authTokenKey) || null };
const pageType = document.body?.dataset.page || 'user';
let marketPrices = {};
let marketHistory = {};
let googleClientId = '';
let isRequestPending = false;

function setMessage(text, type = 'info') {
  const messageEl = document.getElementById('message') || document.getElementById('toastMsg');
  const toast = document.getElementById('toast');
  if (toast && messageEl) {
    messageEl.textContent = text;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  } else if (messageEl) {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
  }
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
  document.querySelectorAll('.panel, .user-panel').forEach((panel) => {
    panel.classList.toggle('hidden', panel.id !== panelId);
  });
  document.querySelectorAll('.nav-link, .user-nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.target === panelId);
  });
}

function setSidebarProfile(profile) {
  const sidebarUser = document.getElementById('sidebar-user');
  const networth = document.getElementById('sidebar-networth');
  const cash = document.getElementById('sidebar-cash');
  const pnl = document.getElementById('sidebar-pnl');
  
  if (sidebarUser) sidebarUser.textContent = profile.username;
  
  const totalValue = profile.portfolio?.totalValue || 0;
  if (networth) networth.textContent = `$${Number(profile.cash + totalValue).toFixed(2)}`;
  if (cash) cash.textContent = `$${Number(profile.cash).toFixed(2)}`;
  if (pnl) pnl.textContent = `$${Number(profile.pnl || 0).toFixed(2)}`;
  
  // Admin page specific
  const profileUsername = document.getElementById('profile-username');
  const profileRole = document.getElementById('profile-role');
  const profileCash = document.getElementById('profile-cash');
  const profilePnl = document.getElementById('profile-pnl');
  const profileHoldings = document.getElementById('profile-holdings');

  if (profileUsername) profileUsername.textContent = profile.username;
  if (profileRole) profileRole.textContent = profile.role;
  if (profileCash) profileCash.textContent = `$${Number(profile.cash).toFixed(2)}`;
  if (profilePnl) profilePnl.textContent = `$${Number(profile.pnl || 0).toFixed(2)}`;
  if (profileHoldings) profileHoldings.textContent = JSON.stringify(profile.holdings || {}, null, 2);
}

function renderPortfolio(profile) {
  const container = document.getElementById('portfolio-summary') || document.getElementById('portfolio-rows');
  if (!container) return;
  
  const positions = profile.portfolio?.positions || {};
  const entries = Object.entries(positions);
  
  if (!entries.length) {
    container.innerHTML = '<div class="empty-state" style="padding: 16px;">No positions in the portfolio yet.</div>';
    return;
  }

  const isUserPanel = container.id === 'portfolio-rows';

  if (isUserPanel) {
    container.innerHTML = entries.map(([asset, data]) => `
      <div class="portfolio-row">
        <div class="asset-meta">
          <strong>${asset}</strong>
        </div>
        <div>${Number(data.quantity).toFixed(2)}</div>
        <div>---</div>
        <div class="positive">---</div>
        <div>$${Number(data.value).toFixed(2)}</div>
      </div>
    `).join('');
  } else {
    container.innerHTML = `
      <table class="admin-table small-table">
        <thead><tr><th>Asset</th><th>Qty</th><th>Value</th></tr></thead>
        <tbody>
          ${entries.map(([asset, data]) => `
            <tr>
              <td>${asset}</td>
              <td>${Number(data.quantity).toFixed(2)}</td>
              <td>$${Number(data.value).toFixed(2)}</td>
            </tr>`
          ).join('')}
        </tbody>
      </table>`;
  }
}

function setStockMax() {
  const stockSelect = document.getElementById('stock-select');
  const quantityInput = document.querySelector('[name=quantity]');
  if (!stockSelect || !quantityInput || !marketPrices) return;
  const stock = stockSelect.value;
  const price = Number(marketPrices[stock] || 0);
  const cashDisplay = document.getElementById('sidebar-cash') || document.getElementById('profile-cash');
  if (!price || !cashDisplay) return;
  const cash = Number(cashDisplay.textContent.replace(/[^0-9.-]+/g, '') || 0);
  const maxQty = Math.floor(cash / price);
  quantityInput.value = String(maxQty > 0 ? maxQty : 1);
}

async function performTrade(action, stock, quantity) {
  if (isRequestPending) return;
  isRequestPending = true;

  try {
    const result = await fetchJson(`/api/trade/${action}`, {
      method: 'POST',
      body: JSON.stringify({ symbol: stock, quantity: Number(quantity) }),
    });
    setMessage(result.message, 'success');
    await loadProfile(); // Refresh portfolio and cash
  } catch (err) {
    setMessage(err.message, 'error');
  } finally {
    isRequestPending = false;
  }
}

async function handleTradeSubmit(event) {
  event.preventDefault();
  const form = event.target;
  const submitter = event.submitter || document.activeElement;
  const action = submitter?.id === 'sell-button' ? 'sell' : 'buy';
  
  const stockSelect = form.querySelector('select[name=stock], #stock-select');
  const quantityInput = form.querySelector('[name=quantity]');
  
  if (!stockSelect || !quantityInput) return;
  
  const stock = stockSelect.value;
  const quantity = Number(quantityInput.value);
  
  if (!stock || !quantity || quantity <= 0) {
    setMessage('Enter a valid stock and quantity.', 'error');
    return;
  }

  await performTrade(action, stock, quantity);
}

async function handleAuth(event, mode) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  const url = mode === 'register' ? '/api/auth/register' : '/api/auth/login';

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

function logout() {
  saveToken(null);
  setMessage('Logged out successfully.', 'info');
  updateAuthUI();
}

function updateAuthUI() {
  const loggedIn = Boolean(state.token);
  const loginView = document.getElementById('login-view');
  const appView = document.getElementById('app-view');
  const logoutButton = document.getElementById('logout-button');
  
  if (loginView && appView) {
    if (loggedIn) {
      loginView.style.display = 'none';
      appView.classList.remove('hidden');
    } else {
      loginView.style.display = 'flex';
      appView.classList.add('hidden');
    }
  }
  if (logoutButton) logoutButton.classList.toggle('hidden', !loggedIn);
}

async function loadProfile() {
  if (!state.token) return;
  try {
    const profile = await fetchJson('/api/users/me');
    setSidebarProfile(profile);
    renderPortfolio(profile);

    if (pageType === 'admin') {
      if (profile.role !== 'admin') {
        setMessage('Admin access is required.', 'error');
        logout();
        return;
      }
      showPanel('dashboard-panel');
      await loadAdminUsers();
      await loadPromoCodes();
      await loadHealthStatus();
      await loadCurrentTrend();
    } else {
      showPanel('panel-overview');
      await loadPromoCodes();
    }
  } catch (error) {
    setMessage('Session expired.', 'error');
    logout();
  }
}

async function loadAdminUsers() {
  const usersList = document.getElementById('users-list');
  if (!usersList) return;
  try {
    const users = await fetchJson('/api/admin/users');
    usersList.innerHTML = users.map(user => `
      <tr>
        <td>${user.username}</td>
        <td>${user.role}</td>
        <td>$${Number(user.cash).toFixed(2)}</td>
        <td><pre style="margin:0">${JSON.stringify(user.holdings || {})}</pre></td>
        <td>$${Number(user.pnl || 0).toFixed(2)}</td>
      </tr>`).join('');
  } catch (err) {
    usersList.innerHTML = '<tr><td colspan="5">Unable to load users.</td></tr>';
  }
}

async function loadPromoCodes() {
  const promoList = document.getElementById('promo-list');
  if (!promoList) return;
  try {
    const promos = await fetchJson('/api/promos');
    promoList.innerHTML = promos.map(promo => `
      <tr>
        <td>${promo.code}</td>
        <td>$${Number(promo.amount).toFixed(2)}</td>
        <td>${promo.maxUses}</td>
        <td>${promo.usedCount}</td>
        <td><span class="status-pill ${promo.active ? 'active' : 'inactive'}">${promo.active ? 'Active' : 'Expired'}</span></td>
        <td><button type="button" class="btn btn-ghost copy-promo-button" style="padding: 8px 12px;" data-code="${promo.code}">Copy</button></td>
      </tr>`).join('');
  } catch (err) {
    promoList.innerHTML = '<tr><td colspan="6">Unable to load promo codes.</td></tr>';
  }
}

async function loadCurrentTrend() {
  const trend = document.getElementById('market-trend');
  if (!trend) return;
  try {
    const data = await fetchJson('/market/trend');
    trend.textContent = data.trend.toUpperCase();
  } catch (_) {
    trend.textContent = 'NORMAL';
  }
}

async function createPromo(event) {
  event.preventDefault();
  const form = event.target;
  let code = form.querySelector('[name=code]').value.trim();
  const amount = Number(form.querySelector('[name=amount]').value);
  const maxUses = Number(form.querySelector('[name=maxUses]').value);

  if (isRequestPending) return;
  isRequestPending = true;

  try {
    await fetchJson('/api/promos', {
      method: 'POST',
      body: JSON.stringify({ code, amount, maxUses }),
    });
    setMessage(`Promo created successfully.`, 'success');
    form.reset();
    await loadPromoCodes();
  } catch (err) {
    setMessage(err.message, 'error');
  } finally {
    isRequestPending = false;
  }
}

async function redeemPromo() {
  const promoInputs = document.querySelectorAll('#promo-input, #promo-input-panel');
  let code = '';
  promoInputs.forEach(input => {
    if (input.value) code = input.value.trim();
  });

  if (!code) {
    setMessage('Enter a promo code.', 'error');
    return;
  }

  if (isRequestPending) return;
  isRequestPending = true;

  try {
    const result = await fetchJson('/api/promos/redeem', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    setMessage(`Redeemed! $${Number(result.amount).toFixed(2)} added to balance.`, 'success');
    promoInputs.forEach(input => input.value = '');
    await loadProfile();
    await loadPromoCodes();
  } catch (err) {
    setMessage(err.message, 'error');
  } finally {
    isRequestPending = false;
  }
}

async function loadHealthStatus() {
  const status = document.getElementById('health-status');
  const dbStatus = document.getElementById('health-db');
  const time = document.getElementById('health-time');
  if (!status || !dbStatus || !time) return;

  try {
    const result = await fetchJson('/api/health');
    status.textContent = result.status;
    dbStatus.textContent = result.db;
    time.textContent = new Date().toLocaleTimeString();
  } catch (err) {
    status.textContent = 'Error';
    dbStatus.textContent = 'Unknown';
  }
}

async function setMarketTrend(trend) {
  try {
    await fetchJson('/api/admin/market-trend', {
      method: 'POST',
      body: JSON.stringify({ trend }),
    });
    await loadCurrentTrend();
    setMessage(`Trend changed to ${trend.toUpperCase()}.`, 'success');
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

  const start = values[0];
  const end = values[values.length - 1];
  const lineColor = end >= start ? '#34d399' : '#f472b6';
  
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
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

function renderMarket(prices, historyData) {
  const pricesEl = document.getElementById('prices');
  const liveMarketRows = document.getElementById('live-market-rows');
  const marketList = document.getElementById('market-list');
  
  const entries = Object.entries(prices);
  
  const cardHtml = entries.map(([name, val]) => {
    const itemHistory = historyData?.[name] || Array(12).fill(val);
    const first = itemHistory[0] || val;
    const changePct = first ? ((val - first) / first) * 100 : 0;
    const changeClass = changePct >= 0 ? 'price-positive' : 'price-negative';
    const changeArrow = changePct >= 0 ? '▲' : '▼';
    const high = Math.max(...itemHistory).toFixed(2);
    const low = Math.min(...itemHistory).toFixed(2);
    return `
    <div class="market-card stock-card glass-panel">
      <div class="stock-card-header">
        <span class="stock-name">${name}</span>
        <span class="price">$${Number(val).toFixed(2)}</span>
      </div>
      <div class="stock-card-details ${changeClass}">${changeArrow} ${Math.abs(changePct).toFixed(2)}%</div>
      <canvas id="sparkline-${name}" width="280" height="70" class="market-canvas"></canvas>
      <div class="stock-card-footer">H: $${high} · L: $${low}</div>
    </div>`;
  }).join('');

  if (pricesEl) pricesEl.innerHTML = cardHtml;
  if (marketList) marketList.innerHTML = cardHtml;
  
  if (liveMarketRows) {
    liveMarketRows.innerHTML = entries.map(([name, val]) => {
      const itemHistory = historyData?.[name] || Array(12).fill(val);
      const first = itemHistory[0] || val;
      const changePct = first ? ((val - first) / first) * 100 : 0;
      const changeClass = changePct >= 0 ? 'price-positive' : 'price-negative';
      return `
      <div class="market-row">
        <div class="asset-meta">
          <strong>${name}</strong>
          <span class="${changeClass}">${Math.abs(changePct).toFixed(2)}%</span>
        </div>
        <div>$${Number(val).toFixed(2)}</div>
        <button class="btn btn-ghost" onclick="document.querySelector('[data-target=panel-trade]').click(); document.getElementById('stock-select').value='${name}';">Trade</button>
      </div>`;
    }).join('');
  }

  setTimeout(() => {
    entries.forEach(([name]) => {
      const canvas = document.getElementById(`sparkline-${name}`);
      if (canvas) drawSparkline(canvas, historyData[name]);
    });
  }, 0);
}

async function updateMarket() {
  try {
    const data = await fetchJson('/market');
    marketPrices = data.prices || {};
    marketHistory = data.history || {};
    renderMarket(marketPrices, marketHistory);
    
    // Auto-update select options if empty
    const selects = document.querySelectorAll('select[name="stock"], #stock-select');
    selects.forEach(select => {
      if (select.options.length === 0) {
        select.innerHTML = Object.keys(marketPrices).map(sym => `<option value="${sym}">${sym}</option>`).join('');
      }
    });

  } catch (err) {
    console.warn('Market data unavailable');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  
  if (loginForm) loginForm.addEventListener('submit', (e) => handleAuth(e, 'login'));
  if (registerForm) registerForm.addEventListener('submit', (e) => handleAuth(e, 'register'));

  // Handle custom buttons from index.html (which don't use <form> tags)
  const btnSignIn = document.getElementById('btnSignIn');
  if (btnSignIn) {
    btnSignIn.addEventListener('click', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('siUsername');
      const passwordInput = document.getElementById('siPassword');
      if (!usernameInput || !passwordInput) return;
      
      const payload = {
        username: usernameInput.value,
        password: passwordInput.value
      };
      
      try {
        const result = await fetchJson('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        saveToken(result.token);
        updateAuthUI();
        await loadProfile();
      } catch (err) {
        setMessage(err.message, 'error');
      }
    });
  }

  const btnSignUp = document.getElementById('btnSignUp');
  if (btnSignUp) {
    btnSignUp.addEventListener('click', async (e) => {
      e.preventDefault();
      const usernameInput = document.getElementById('suUsername');
      const emailInput = document.getElementById('suEmail');
      const phoneInput = document.getElementById('suPhone');
      const passwordInput = document.getElementById('suPassword');
      
      if (!usernameInput || !passwordInput) return;
      
      const payload = {
        username: usernameInput.value,
        password: passwordInput.value,
        email: emailInput ? emailInput.value : undefined,
        phone: phoneInput ? phoneInput.value : undefined
      };
      
      try {
        const result = await fetchJson('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        saveToken(result.token);
        updateAuthUI();
        await loadProfile();
      } catch (err) {
        setMessage(err.message, 'error');
      }
    });
  }
  
  const logoutButtons = document.querySelectorAll('#logout-button');
  logoutButtons.forEach(btn => btn.addEventListener('click', logout));

  const promoForm = document.getElementById('promo-form');
  if (promoForm) promoForm.addEventListener('submit', createPromo);

  const generateBtn = document.getElementById('generate-code');
  if (generateBtn) {
    generateBtn.addEventListener('click', () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      document.querySelector('[name=code]').value = Array.from({length: 8}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    });
  }

  const redeemBtns = document.querySelectorAll('#redeem-promo, #redeem-button');
  redeemBtns.forEach(btn => btn.addEventListener('click', redeemPromo));

  document.querySelectorAll('.nav-link, .user-nav-link').forEach((link) => {
    link.addEventListener('click', () => showPanel(link.dataset.target));
  });

  document.querySelectorAll('.trend-button[data-trend]').forEach((button) => {
    button.addEventListener('click', () => setMarketTrend(button.dataset.trend));
  });

  const maxBtn = document.getElementById('stock-max-button');
  if (maxBtn) maxBtn.addEventListener('click', setStockMax);
  
  const purchaseForm = document.getElementById('purchase-form') || document.getElementById('trade-form');
  if (purchaseForm) purchaseForm.addEventListener('submit', handleTradeSubmit);

  // Add click handlers to trade form buttons if no submit event
  const buyBtn = document.getElementById('buy-button');
  const sellBtn = document.getElementById('sell-button');
  if (buyBtn && !purchaseForm) buyBtn.addEventListener('click', (e) => handleTradeSubmit({ preventDefault: () => {}, target: buyBtn.closest('form'), submitter: buyBtn }));
  if (sellBtn && !purchaseForm) sellBtn.addEventListener('click', (e) => handleTradeSubmit({ preventDefault: () => {}, target: sellBtn.closest('form'), submitter: sellBtn }));

  document.body.addEventListener('click', (event) => {
    const button = event.target.closest('.copy-promo-button');
    if (button) {
      navigator.clipboard.writeText(button.dataset.code);
      setMessage(`Copied ${button.dataset.code}`, 'info');
    }
  });

  updateAuthUI();
  if (state.token) {
    loadProfile();
  }
  updateMarket();
  setInterval(updateMarket, 3000);
});
