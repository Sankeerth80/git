const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('./models/User');

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/quantumtrade';
const JWT_SECRET = process.env.JWT_SECRET || 'quantumtrade-secret';
let marketTrend = 'normal';

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function appendLog(fileName, message) {
  const filePath = path.join(logsDir, fileName);
  fs.appendFile(filePath, `${message}\n`, (err) => {
    if (err) {
      console.error('Unable to write log:', err);
    }
  });
}

function logRequest(req, res, durationMs) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const time = new Date().toISOString();
  const line = `${time} | ${ip} | ${req.method} ${req.originalUrl} | ${res.statusCode} | ${durationMs}ms`;
  appendLog('access.log', line);
  console.log(line);
}

function logError(req, err) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const time = new Date().toISOString();
  const line = `${time} | ${ip} | ${req.method} ${req.originalUrl} | ${err.message} | ${err.stack || 'no-stack'}`;
  appendLog('error.log', line);
  console.error(line);
}

const marketData = {
  BTC: 62000,
  ETH: 4200,
  SOL: 185,
  ADA: 0.95,
  LINK: 22,
};

const marketHistory = Object.fromEntries(
  Object.keys(marketData).map((symbol) => [symbol, Array.from({ length: 16 }, () => marketData[symbol])])
);

const assetVolatility = {
  BTC: 0.02,
  ETH: 0.03,
  SOL: 0.045,
  ADA: 0.055,
  LINK: 0.05,
};

const trendBias = {
  normal: 0,
  bull: 0.035,
  bear: -0.025,
  crash: -0.12,
};

function randomWalk(value, symbol) {
  const base = assetVolatility[symbol] || 0.03;
  const bias = trendBias[marketTrend] || 0;
  const randomFactor = (Math.random() * 2 - 1) * base;
  const change = value * (randomFactor + bias);
  return Math.max(0.01, Number((value + change).toFixed(2)));
}

function getDbState() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || mongoose.connection.readyState;
}

const app = express();
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => logRequest(req, res, Date.now() - start));
  next();
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter, require('./routes/users'));

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const user = jwt.verify(token, JWT_SECRET);
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/market-trend', adminAuth, (req, res) => {
  const { trend } = req.body;
  const validTrends = ['normal', 'bull', 'bear', 'crash'];
  if (!trend || !validTrends.includes(trend)) {
    return res.status(400).json({ error: 'Invalid trend' });
  }
  marketTrend = trend;
  res.json({ trend, message: `Market trend set to ${trend}` });
});

app.get('/api/market-trend', (req, res) => {
  res.json({ trend: marketTrend });
});

app.get('/auth/google', (req, res) => {
  res.json({
    message: 'Google OAuth is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then implement a real OAuth flow.',
  });
});

app.get('/auth/microsoft', (req, res) => {
  res.json({
    message: 'Microsoft OAuth is not configured yet. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET, then implement a real OAuth flow.',
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get(['/admin', '/admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'admin.html'));
});

app.use(express.static(path.join(__dirname, 'frontend'), { extensions: ['html'] }));

app.use((err, req, res, next) => {
  logError(req, err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Internal Server Error' });
});

const server = http.createServer((req, res) => {
  const host = req.headers.host || `localhost:${PORT}`;
  const url = new URL(req.url || '/', `http://${host}`);
  const requestStart = Date.now();

  if (req.method === 'GET' && url.pathname === '/market') {
    Object.keys(marketData).forEach((symbol) => {
      marketData[symbol] = randomWalk(marketData[symbol], symbol);
      marketHistory[symbol].push(marketData[symbol]);
      if (marketHistory[symbol].length > 24) {
        marketHistory[symbol].shift();
      }
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ prices: marketData, history: marketHistory, trend: marketTrend }));
    return logRequest(req, res, Date.now() - requestStart);
  }

  if (req.method === 'GET' && url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', db: getDbState() }));
    return logRequest(req, res, Date.now() - requestStart);
  }

  app(req, res);
});

mongoose.set('strictQuery', false);
mongoose.connection.on('connected', () => {
  console.log('MongoDB connected');
});
mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error.message);
});
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

async function ensureAdminUser() {
  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    console.log('Admin user already exists:', existingAdmin.username);
    return;
  }

  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@1234';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const adminUser = new User({
    username: adminUsername,
    password: hashedPassword,
    role: 'admin',
    cash: 10000,
    holdings: {},
    pnl: 0,
  });

  await adminUser.save();
  console.log(`Default admin created: ${adminUsername}`);
  console.log('Use password:', adminPassword);
}

async function ensureDefaultUser() {
  const defaultUsername = process.env.DEFAULT_USERNAME || 'Sankeerth';
  const existingUser = await User.findOne({ username: defaultUsername });
  if (existingUser) {
    console.log('Default user already exists:', existingUser.username);
    return;
  }

  const defaultPassword = process.env.DEFAULT_PASSWORD || 'Sankeerth@80';
  const hashedPassword = await bcrypt.hash(defaultPassword, 10);

  const defaultUser = new User({
    username: defaultUsername,
    password: hashedPassword,
    role: 'user',
    cash: 1500,
    holdings: {},
    pnl: 0,
  });

  await defaultUser.save();
  console.log(`Default user created: ${defaultUsername}`);
  console.log('Use password:', defaultPassword);
}

async function startServer() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`Connected to MongoDB at ${MONGO_URI}`);
    await ensureAdminUser();
    await ensureDefaultUser();
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.error('Please start MongoDB or set MONGODB_URI.');
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = server;
