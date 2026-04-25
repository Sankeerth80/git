const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Promo = require('../models/Promo');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'quantumtrade-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function generatePromoCode(length = 8) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

router.post('/register', async (req, res) => {
  const { username, password, phone, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const normalizedUsername = normalizeUsername(username);
  const query = [{ username: normalizedUsername }];
  if (email) {
    query.push({ email: email.toLowerCase().trim() });
  }

  const existingUser = await User.findOne({ $or: query });
  if (existingUser) {
    return res.status(409).json({ error: 'Username or email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({
    username: normalizedUsername,
    email: email ? email.toLowerCase().trim() : undefined,
    password: hashedPassword,
    phone,
    ip: req.ip,
    cash: 1000,
    holdings: {},
  });

  await user.save();

  const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({
    token,
    user: {
      id: user._id,
      username: user.username,
      role: user.role,
      cash: user.cash,
      holdings: user.holdings,
      pnl: user.pnl,
    },
  });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const loginIdentifier = username.toLowerCase().trim();
  const user = await User.findOne({
    $or: [
      { username: loginIdentifier },
      { email: loginIdentifier },
      { username: { $regex: new RegExp(`^${loginIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }$`, 'i') } },
    ],
  });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const validPassword = user.password ? await bcrypt.compare(password, user.password) : false;
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({
    token,
    user: {
      id: user._id,
      username: user.username,
      role: user.role,
      cash: user.cash,
      holdings: user.holdings,
      pnl: user.pnl,
    },
  });
});

router.post('/auth/google', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) {
    return res.status(400).json({ error: 'Google ID token is required' });
  }
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'Google client ID is not configured on the server' });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid Google ID token' });
  }

  if (!payload || !payload.sub || !payload.email) {
    return res.status(400).json({ error: 'Google token did not return required account data' });
  }

  const email = payload.email.toLowerCase();
  const googleId = payload.sub;
  const displayName = payload.name || email.split('@')[0];

  let user = await User.findOne({ $or: [{ googleId }, { email }] });
  if (!user) {
    let username = displayName.trim().replace(/\s+/g, '_').toLowerCase();
    if (!username) username = email.split('@')[0];
    let suffix = 1;
    while (await User.exists({ username })) {
      username = `${displayName.replace(/\s+/g, '_').toLowerCase()}${suffix}`;
      suffix += 1;
    }

    user = new User({
      username,
      email,
      googleId,
      password: undefined,
      role: 'user',
      ip: req.ip,
      cash: 1000,
      holdings: {},
    });
    await user.save();
  } else if (!user.googleId) {
    user.googleId = googleId;
    if (!user.username) user.username = displayName.replace(/\s+/g, '_').toLowerCase();
    await user.save();
  }

  const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });

  res.json({
    token,
    user: {
      id: user._id,
      username: user.username,
      role: user.role,
      cash: user.cash,
      holdings: user.holdings,
      pnl: user.pnl,
    },
  });
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

router.get('/users', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const users = await User.find().select('-password');
  res.json(users);
});

router.get('/promos', authMiddleware, async (req, res) => {
  const query = req.user.role === 'admin' ? {} : { active: true };
  const promos = await Promo.find(query).sort({ createdAt: -1 }).lean();
  const normalized = promos.map((promo) => ({
    code: promo.code,
    amount: promo.amount || promo.discountPercent || 0,
    maxUses: promo.maxUses,
    usedCount: promo.usedCount,
    active: promo.active,
    createdBy: promo.createdBy,
    createdAt: promo.createdAt,
  }));
  res.json(normalized);
});

router.post('/promos', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  let { code, amount, maxUses } = req.body;
  amount = Number(amount);
  maxUses = Number(maxUses);

  if (!amount || amount <= 0 || !maxUses || maxUses < 1) {
    return res.status(400).json({ error: 'Amount and max uses are required, with amount greater than 0.' });
  }

  if (!code) {
    code = generatePromoCode(10);
  }

  const existingPromo = await Promo.findOne({ code });
  if (existingPromo) {
    return res.status(409).json({ error: 'Promo code already exists' });
  }

  const promo = new Promo({
    code,
    amount,
    maxUses,
    createdBy: req.user.username,
  });

  await promo.save();
  res.status(201).json(promo);
});

router.post('/promos/redeem', authMiddleware, async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Promo code is required' });
  }

  const promo = await Promo.findOne({ code });
  if (!promo || !promo.active) {
    return res.status(404).json({ error: 'Promo code not found or inactive' });
  }

  if (promo.usedCount >= promo.maxUses) {
    promo.active = false;
    await promo.save();
    return res.status(400).json({ error: 'Promo code has expired' });
  }

  const user = await User.findById(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const deposit = promo.amount || promo.discountPercent || 0;
  if (!deposit) {
    return res.status(400).json({ error: 'Promo code has no amount configured' });
  }

  if (!promo.amount && promo.discountPercent) {
    promo.amount = deposit;
  }

  promo.usedCount += 1;
  if (promo.usedCount >= promo.maxUses) {
    promo.active = false;
  }
  await promo.save();

  user.cash = Number((user.cash + deposit).toFixed(2));
  await user.save();

  res.json({
    code: promo.code,
    amount: deposit,
    remainingUses: promo.maxUses - promo.usedCount,
    active: promo.active,
    newCash: user.cash,
  });
});

module.exports = router;
