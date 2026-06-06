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

// Route imports
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
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
    // Common production hostnames
    'https://www.cashflowhubs.com',
    'https://cashflowhubs.onrender.com',
    ...configuredOrigins,
  ]);
};

const allowedOrigins = parseAllowedOrigins();
const allowedOriginPatterns = [
  /^https:\/\/.*\.vercel\.app$/,
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.has(origin)) return true;
  return allowedOriginPatterns.some((pattern) => pattern.test(origin));
};

// Connect to databases
connectDB();
connectRedis();

// Security middleware
app.use(helmet());
app.use(mongoSanitize());
app.use(hpp());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  handler: rateLimitJsonHandler('Too many requests from this IP, please try again later.')
});
app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 200 : 60,
  message: 'Too many authentication attempts, please try again later.',
  handler: rateLimitJsonHandler('Too many authentication attempts, please try again later.'),
  skip: (req) => process.env.NODE_ENV === 'development' && req.path === '/send-otp',
});
app.use('/api/auth/', authLimiter);

// CORS
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    logger.warn(`Blocked CORS origin: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Timezone',
    'X-Device-Fingerprint',
    'Accept-Language',
  ]
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());
app.use('/uploads', express.static('uploads'));

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
server.listen(PORT, () => {
  logger.info(`CashFlawHubs server running on port ${PORT} [${process.env.NODE_ENV}]`);
  startJobScheduler();
  startQueueWorker();
  void syncJobs().catch((error) => {
    logger.error(`Initial job sync failed: ${error.message}`);
  });
});

module.exports = app;
