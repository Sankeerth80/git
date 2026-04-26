const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'quantumtrade-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

const generateToken = (id, username, role) => {
  return jwt.sign({ id, username, role }, JWT_SECRET, { expiresIn: '7d' });
};

exports.register = async (req, res, next) => {
  try {
    const { username, password, phone, email } = req.body;
    const ip = req.ip;

    const normalizedUsername = String(username || '').trim();
    const normalizedEmail = email ? email.toLowerCase().trim() : undefined;

    const orConditions = [{ username: new RegExp('^' + normalizedUsername + '$', 'i') }];
    if (normalizedEmail) {
      orConditions.push({ email: normalizedEmail });
    }

    const existingUser = await User.findOne({ $or: orConditions });

    if (existingUser) {
      console.warn(`[auth] register conflict: username='${normalizedUsername}' email='${normalizedEmail || ''}' ip=${req.ip}`);
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      ip,
      cash: 1000,
      holdings: {},
    });

    await user.save();
    console.log(`[auth] register success: username='${user.username}' id=${user._id} ip=${req.ip}`);

    res.status(201).json({
      token: generateToken(user._id, user.username, user.role),
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        cash: user.cash,
        holdings: user.holdings,
        pnl: user.pnl,
      },
    });
  } catch (error) {
    console.error(`[auth] register error: username='${req.body?.username}' ip=${req.ip} — ${error.message}`);
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip;

    const loginIdentifier = String(username || '').trim();
    const user = await User.findOne({
      $or: [
        { username: new RegExp('^' + loginIdentifier + '$', 'i') },
        { email: new RegExp('^' + loginIdentifier + '$', 'i') },
      ],
    });

    if (!user || !user.password) {
      console.warn(`[auth] login failed (user not found): identifier='${loginIdentifier}' ip=${req.ip}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn(`[auth] login failed (bad password): username='${user.username}' id=${user._id} ip=${req.ip}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`[auth] login success: username='${user.username}' id=${user._id} role=${user.role} ip=${req.ip}`);
    res.json({
      token: generateToken(user._id, user.username, user.role),
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        cash: user.cash,
        holdings: user.holdings,
        pnl: user.pnl,
      },
    });
  } catch (error) {
    console.error(`[auth] login error: identifier='${req.body?.username}' ip=${req.ip} — ${error.message}`);
    next(error);
  }
};

exports.googleLogin = async (req, res, next) => {
  // Same logic as before, refactored to controller
  try {
    const { idToken } = req.body;
    const ip = req.ip;

    if (!GOOGLE_CLIENT_ID) {
      console.error(`[auth] google login error: GOOGLE_CLIENT_ID not configured ip=${ip}`);
      return res.status(500).json({ error: 'Google client ID is not configured' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const email = payload.email.toLowerCase();
    const googleId = payload.sub;
    const displayName = payload.name || email.split('@')[0];

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (!user) {
      let username = displayName.trim().replace(/\s+/g, '_').toLowerCase();
      let suffix = 1;
      while (await User.exists({ username })) {
        username = `${displayName.replace(/\s+/g, '_').toLowerCase()}${suffix}`;
        suffix++;
      }

      user = new User({
        username,
        email,
        googleId,
        role: 'user',
        ip,
        cash: 1000,
        holdings: {},
      });
      await user.save();
      console.log(`[auth] google login: new user created username='${user.username}' id=${user._id} ip=${req.ip}`);
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
      console.log(`[auth] google login: linked googleId to existing user username='${user.username}' id=${user._id} ip=${req.ip}`);
    } else {
      console.log(`[auth] google login success: username='${user.username}' id=${user._id} ip=${req.ip}`);
    }

    res.json({
      token: generateToken(user._id, user.username, user.role),
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        cash: user.cash,
        holdings: user.holdings,
        pnl: user.pnl,
      },
    });
  } catch (error) {
    console.error(`[auth] google login error: ip=${req.ip} — ${error.message}`);
    res.status(401).json({ error: 'Invalid Google ID token' });
  }
};
