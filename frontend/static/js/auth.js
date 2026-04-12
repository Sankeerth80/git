const authTokenKey = 'quantumtrade-auth-token';
let currentOtp = null;

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

function getAuthHeaders() {
  const token = window.localStorage.getItem(authTokenKey);
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
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
  await postAuth('/api/login', { username, password });
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
  await postAuth('/api/register', { username, password, email, phone });
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
  document.getElementById('pillEmail').addEventListener('click', () => switchMethod('email'));
  document.getElementById('pillPhone').addEventListener('click', () => switchMethod('phone'));
  document.getElementById('pillSocial').addEventListener('click', () => switchMethod('social'));
  document.getElementById('btnSignIn').addEventListener('click', handleSignIn);
  document.getElementById('btnSignUp').addEventListener('click', handleSignUp);
  document.getElementById('btnSendOtp').addEventListener('click', handleSendOtp);
  document.getElementById('btnVerifyOtp').addEventListener('click', handleVerifyOtp);
  document.getElementById('btnGoogle').addEventListener('click', () => socialAuth('google'));
  document.getElementById('btnMicrosoft').addEventListener('click', () => socialAuth('microsoft'));

  switchTab('signin');
  switchMethod('email');
}

window.work = work;
window.addEventListener('DOMContentLoaded', work);