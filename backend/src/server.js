require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const connectRedis = require('./config/redis');
const logger = require('./utils/logger');
const { syncJobs } = require('./controllers/jobController');
const { startJobScheduler } = require('./services/jobScheduler');
const { startQueueWorker } = require('./services/queueWorker');
const { initSocket } = require('./services/socketService');
const { processDueBroadcasts } = require('./services/broadcastProcessor');
const captureIp = require('./middleware/captureIp');

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const twoFactorRoutes = require('./routes/twoFactor');
const paymentRoutes = require('./routes/payments');
const referralRoutes = require('./routes/referrals');
const surveyRoutes = require('./routes/surveys');
const taskRoutes = require('./routes/tasks');
const jobRoutes = require('./routes/jobs');
const offerwallRoutes = require('./routes/offerwalls');
const cashTaskRoutes = require('./routes/cashTasks');
const walletRoutes = require('./routes/wallet');
const withdrawalRoutes = require('./routes/withdrawals');
const freelanceRoutes = require('./routes/freelance');
const challengeRoutes = require('./routes/challenges');
const adminRoutes = require('./routes/admin');
const internalRoutes = require('./routes/internalRoutes');
const notificationRoutes = require('./routes/notifications');
const catalogRoutes = require('./routes/catalog');
const adsNetworkRoutes = require('./routes/adsNetwork');
const adminAdvancedRoutes = require('./routes/adminAdvanced');
const chatRoutes = require('./routes/chat');
const cpxRoutes = require('./routes/cpxRoutes');
const adgemRoutes = require('./routes/adgem');
const adminFraudRoutes = require('./routes/adminFraud');
const ledgerAuthRoutes = require('./routes/ledgerAuth');
const ledgerPayoutsRoutes = require('./routes/ledgerPayouts');
const ledgerAuditLogsRoutes = require('./routes/ledgerAuditLogs');
const ledgerActivationsRoutes = require('./routes/ledgerActivations');
const ledgerDashboardRoutes = require('./routes/ledgerDashboard');
const ledgerRailsRoutes = require('./routes/ledgerRails');
const ledgerRulesRoutes = require('./routes/ledgerRules');
const ledgerBatchesRoutes = require('./routes/ledgerBatches');
const creatorHubRoutes = require('./routes/creatorHub');
const mongoose = require('mongoose');
const { startCpxVerificationWorker } = require('./workers/cpxVerificationWorker');

const app = express();
const server = http.createServer(app);
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY : 1);

const rateLimitJsonHandler = (message) => (req, res) => {
  res.status(429).json({ success: false, message });
};

const parseAllowedOrigins = () => {
  const configuredOrigins = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_APP_URL,
    process.env.APP_URL,
    process.env.CORS_ORIGIN,
    process.env.ALLOWED_ORIGINS,
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);

  return new Set([
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:3002',
    // Common production hostnames
    'https://www.cashflowhubs.com',
    'https://cashflowhubs.onrender.com',
    // Staff frontends
    'https://admin.cashflowhubs.com',
    'https://ledger.cashflowhubs.com',
    'https://cashflowhubs-admin-omega.vercel.app',
    'https://cashflowhubs-ledger-livid.vercel.app',
    ...configuredOrigins,
  ]);
};

const allowedOrigins = parseAllowedOrigins();
const allowedOriginPatterns = [
  new RegExp("^https://cashflowhubs-[a-z0-9-]+\\.vercel\\.app$"),
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return allowedOriginPatterns.some((pattern) => pattern.test(origin));
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    logger.warn(`Blocked CORS origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Timezone',
    'X-Device-Fingerprint',
    'Accept-Language',
    'X-Requested-With',
    'x-background-refresh',
  ],
};

// Connect to databases
connectDB();
connectRedis();

// Security middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(mongoSanitize());
app.use(hpp());

// Ensure preflight responses include any requested headers for allowed origins.
// This reflects the `Access-Control-Request-Headers` back when the origin is allowed
// so custom headers like `x-background-refresh` are accepted by browsers.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || !isAllowedOrigin(origin)) return next();
  const requested = req.headers['access-control-request-headers'];
  if (requested) {
    res.setHeader('Access-Control-Allow-Headers', requested);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  return next();
});

// CORS needs to run before rate limiters so browser preflights are answered
// with the proper headers instead of being treated like blocked requests.
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  message: 'Too many requests from this IP, please try again later.',
  handler: (req, res) => {
    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.status(429).json({ success: false, message: 'Too many requests, please try again later.' });
  }
});
app.use('/api/', (req, res, next) => {
  const isCallback =
    req.path.includes('/callback') ||
    req.path.includes('/webhook') ||
    req.path.includes('/postback');
  if (isCallback) return next();
  return limiter(req, res, next);
});

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 200 : 60,
  message: 'Too many authentication attempts, please try again later.',
  handler: rateLimitJsonHandler('Too many authentication attempts, please try again later.'),
  skip: (req) => process.env.NODE_ENV === 'development' && req.path === '/send-otp',
});
app.use('/api/auth/', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use('/uploads', express.static('uploads'));

// IP capture middleware on authenticated requests
app.use(captureIp);

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString(), version: '1.0.0' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/offerwalls', offerwallRoutes);
app.use('/api/cash-tasks', cashTaskRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/withdrawals', withdrawalRoutes);
app.use('/api/freelance', freelanceRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/internal', internalRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/ads-network', adsNetworkRoutes);
app.use('/api/admin-advanced', adminAdvancedRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/cpx', cpxRoutes);
app.use('/api/adgem', adgemRoutes);
app.use('/api/admin-fraud', adminFraudRoutes);
app.use('/api/ledger/auth', ledgerAuthRoutes);
app.use('/api/ledger/payouts', ledgerPayoutsRoutes);
app.use('/api/ledger/audit-logs', ledgerAuditLogsRoutes);
app.use('/api/ledger/activations', ledgerActivationsRoutes);
app.use('/api/ledger/dashboard', ledgerDashboardRoutes);
app.use('/api/ledger/rails', ledgerRailsRoutes);
app.use('/api/ledger/rules', ledgerRulesRoutes);
app.use('/api/ledger/batches', ledgerBatchesRoutes);
app.use('/api/creator-hub', creatorHubRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  logger.error(`${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Server error' : err.message
  });
});

const PORT = process.env.PORT || 5000;
const io = initSocket(server, Array.from(allowedOrigins));
app.set('io', io);

server.on('error', (error) => {
  if (error?.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Another backend instance may still be running.`);
  } else {
    logger.error(`Server error: ${error?.message || error}`);
  }
  process.exit(1);
});

server.listen(PORT, () => {
  logger.info(`CashFlawHubs server running on port ${PORT} [${process.env.NODE_ENV}]`);
  
  const { refreshExchangeRates } = require('./services/exchangeService');
  refreshExchangeRates(); // immediate on startup
  setInterval(refreshExchangeRates, 25 * 60 * 1000); // every 25 min

  startJobScheduler();
  startQueueWorker();
  setInterval(() => {
    void processDueBroadcasts().catch((error) => {
      logger.error(`Broadcast processor failed: ${error.message}`);
    });
  }, 60 * 1000);
  void processDueBroadcasts().catch((error) => {
    logger.error(`Initial broadcast processor run failed: ${error.message}`);
  });
  void syncJobs().catch((error) => {
    logger.error(`Initial job sync failed: ${error.message}`);
  });

  // Start CPX Verification background worker once mongoose connects
  mongoose.connection.once('open', () => {
    startCpxVerificationWorker();
  });
});

module.exports = app;
