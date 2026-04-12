const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Promo = require('../models/Promo');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'quantumtrade-secret';

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

router.post('/register', async (req, res) => {
  const { username, password, phone, email } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const query = [{ username }];
  if (email) {
    query.push({ email: email.toLowerCase().trim() });
  }

  const existingUser = await User.findOne({ $or: query });
  if (existingUser) {
    return res.status(409).json({ error: 'Username or email already exists' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({
    username,
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
    $or: [{ username: loginIdentifier }, { email: loginIdentifier }],
  });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
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
  const promos = await Promo.find(query).sort({ createdAt: -1 });
  res.json(promos);
});

router.post('/promos', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { code, discountPercent, maxUses } = req.body;
  if (!code || !discountPercent || !maxUses) {
    return res.status(400).json({ error: 'Code, discount percent, and max uses are required' });
  }

  const existingPromo = await Promo.findOne({ code });
  if (existingPromo) {
    return res.status(409).json({ error: 'Promo code already exists' });
  }

  const promo = new Promo({
    code,
    discountPercent,
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

  promo.usedCount += 1;
  if (promo.usedCount >= promo.maxUses) {
    promo.active = false;
  }
  await promo.save();

  res.json({
    code: promo.code,
    discountPercent: promo.discountPercent,
    remainingUses: promo.maxUses - promo.usedCount,
    active: promo.active,
  });
});

module.exports = router;
