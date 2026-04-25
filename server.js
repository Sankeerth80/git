require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');
const { apiLimiter } = require('./middleware/rateLimiter');

// Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const promoRoutes = require('./routes/promoRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const adminRoutes = require('./routes/adminRoutes');
const marketRoutes = require('./routes/marketRoutes');

// Models
const User = require('./models/User');
const Promo = require('./models/Promo');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to Database
connectDB();

// Security & Optimization Middlewares
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Setup logging with Morgan
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const accessLogStream = fs.createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });
app.use(morgan('combined', { stream: accessLogStream }));
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rate Limiting on APIs
app.use('/api/', apiLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/market', marketRoutes);

app.get('/api/config', (req, res) => {
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

app.get('/api/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const dbState = states[mongoose.connection.readyState] || mongoose.connection.readyState;
  res.status(200).json({ status: 'ok', db: dbState });
});

// Serve static files
app.use(express.static(path.join(__dirname, 'frontend'), { extensions: ['html'] }));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.get(['/admin', '/admin.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'admin.html'));
});

// Error Handlers
app.use(notFound);
app.use(errorHandler);

// Prevent unhandled promise rejections crashing the app
process.on('unhandledRejection', (err) => {
  console.error(`Unhandled Rejection: ${err.message}`);
  // Do not exit in production, log and monitor
});

// Admin & Demo Setup Helpers
async function ensureAdminUser() {
  try {
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) return;

    const adminUsername = process.env.ADMIN_USERNAME || 'Sankeerth';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Satyamani80';
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
  } catch (error) {
    console.error('Failed to create admin user:', error.message);
  }
}

async function ensureDemoPromos() {
  try {
    const promoCount = await Promo.countDocuments();
    if (promoCount === 0) {
      const demoPromos = [
        { code: 'DEMO1000', amount: 1000, maxUses: 10, createdBy: 'system' },
        { code: 'WELCOME500', amount: 500, maxUses: 25, createdBy: 'system' },
        { code: 'TRADE250', amount: 250, maxUses: 50, createdBy: 'system' },
      ];
      await Promo.insertMany(demoPromos);
      console.log('Demo promo codes created.');
    }
  } catch (error) {
    console.error('Failed to create demo promos:', error.message);
  }
}

mongoose.connection.once('open', () => {
  ensureAdminUser();
  ensureDemoPromos();
});

const server = http.createServer(app);

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

module.exports = server;
