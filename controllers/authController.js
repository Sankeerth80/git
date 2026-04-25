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
    
    const normalizedUsername = String(username || '').trim();
    const normalizedEmail = email ? email.toLowerCase().trim() : undefined;

    const orConditions = [{ username: new RegExp('^' + normalizedUsername + '$', 'i') }];
    if (normalizedEmail) {
      orConditions.push({ email: normalizedEmail });
    }

    const existingUser = await User.findOne({ $or: orConditions });

    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({
      username: normalizedUsername,
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      ip: req.ip,
      cash: 1000,
      holdings: {},
    });

    await user.save();

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
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const loginIdentifier = String(username || '').trim();
    const user = await User.findOne({
      $or: [
        { username: new RegExp('^' + loginIdentifier + '$', 'i') },
        { email: new RegExp('^' + loginIdentifier + '$', 'i') },
      ],
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
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
    next(error);
  }
};

exports.googleLogin = async (req, res, next) => {
  // Same logic as before, refactored to controller
  try {
    const { idToken } = req.body;
    if (!GOOGLE_CLIENT_ID) {
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
        ip: req.ip,
        cash: 1000,
        holdings: {},
      });
      await user.save();
    } else if (!user.googleId) {
      user.googleId = googleId;
      await user.save();
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
    res.status(401).json({ error: 'Invalid Google ID token' });
  }
};
