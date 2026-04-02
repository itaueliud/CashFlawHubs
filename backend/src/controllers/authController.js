const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');
const { sendSMS } = require('../services/notificationService');
const { COUNTRIES } = require('../config/countries');

// Generate JWT
const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// Generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// @POST /api/auth/send-otp
exports.sendOTP = async (req, res) => {
  try {
    const { phone, country } = req.body;
    if (!phone || !country) return res.status(400).json({ success: false, message: 'Phone and country required' });
    if (!COUNTRIES[country]) return res.status(400).json({ success: false, message: 'Unsupported country' });

    // BYPASS OTP in development (no Redis needed)
    if (process.env.NODE_ENV === 'development') {
      logger.info(`[DEV MODE] OTP bypassed for ${phone} - use any 6-digit code`);
      return res.json({ success: true, message: 'OTP sent successfully (DEV: use any 6-digit code)' });
    }

    const otp = generateOTP();
    const redis = getRedis();
    await redis.setex(`otp:${phone}`, 300, otp); // 5 min TTL

    await sendSMS(phone, `Your CashflowConnect verification code is: ${otp}. Valid for 5 minutes.`);

    logger.info(`OTP sent to ${phone}`);
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    logger.error(`sendOTP error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

// @POST /api/auth/register
exports.register = async (req, res) => {
  try {
    const { name, phone, country, password, referralCode, otp } = req.body;

    // BYPASS OTP verification in development
    if (process.env.NODE_ENV !== 'development') {
      // Verify OTP (production only)
      const redis = getRedis();
      const storedOTP = await redis.get(`otp:${phone}`);
      if (!storedOTP || storedOTP !== otp) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
      }
      await redis.del(`otp:${phone}`);
    } else {
      logger.info(`[DEV MODE] OTP verification bypassed for ${phone}`);
    }

    // Check if phone exists
    const existing = await User.findOne({ phone });
    if (existing) return res.status(409).json({ success: false, message: 'Phone number already registered' });

    // Find referrer if code provided
    let referrer = null;
    if (referralCode) {
      referrer = await User.findOne({ referralCode });
    }

    const user = await User.create({
      name,
      phone,
      country,
      passwordHash: password,
      referredBy: referrer ? referrer.referralCode : null,
      phoneVerified: true,
    });

    // Create wallet
    await Wallet.create({ userId: user._id });

    const token = signToken(user._id);
    logger.info(`New user registered: ${user.userId} from ${country}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        phone: user.phone,
        country: user.country,
        referralCode: user.referralCode,
        activationStatus: user.activationStatus,
        level: user.level,
      },
    });
  } catch (error) {
    logger.error(`register error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) return res.status(400).json({ success: false, message: 'Phone and password required' });

    const user = await User.findOne({ phone }).select('+passwordHash');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    if (user.isBanned) return res.status(403).json({ success: false, message: 'Account suspended. Contact support.' });

    // Check lockout
    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(429).json({ success: false, message: 'Account temporarily locked. Try again later.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 min lock
      }
      await user.save();
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Reset failed attempts
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.updateStreak();
    await user.save();

    const token = signToken(user._id);
    const wallet = await Wallet.findOne({ userId: user._id });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        phone: user.phone,
        country: user.country,
        referralCode: user.referralCode,
        activationStatus: user.activationStatus,
        level: user.level,
        xpPoints: user.xpPoints,
        streak: user.streak,
        badges: user.badges,
        balanceUSD: wallet?.balanceUSD || 0,
      },
    });
  } catch (error) {
    logger.error(`login error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

// @GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const wallet = await Wallet.findOne({ userId: user._id });
    res.json({ success: true, user, wallet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
