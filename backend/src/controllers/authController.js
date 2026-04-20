const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');
const { sendSMS, sendEmail } = require('../services/notificationService');
const { COUNTRIES } = require('../config/countries');
const { TOKEN_PACKAGES } = require('../config/monetization');
const devAuthStore = require('../services/devAuthStore');

const CODE_TTL_SECONDS = 300;
const fallbackStore = new Map();

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

const getStoreKey = (namespace, key) => `${namespace}:${String(key).toLowerCase()}`;

const setCode = async (namespace, key, value, ttlSeconds = CODE_TTL_SECONDS) => {
  const storeKey = getStoreKey(namespace, key);
  try {
    const redis = getRedis();
    await redis.setex(storeKey, ttlSeconds, value);
    return;
  } catch {
    fallbackStore.set(storeKey, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }
};

const getCode = async (namespace, key) => {
  const storeKey = getStoreKey(namespace, key);
  try {
    const redis = getRedis();
    return await redis.get(storeKey);
  } catch {
    const entry = fallbackStore.get(storeKey);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      fallbackStore.delete(storeKey);
      return null;
    }
    return entry.value;
  }
};

const clearCode = async (namespace, key) => {
  const storeKey = getStoreKey(namespace, key);
  try {
    const redis = getRedis();
    await redis.del(storeKey);
    return;
  } catch {
    fallbackStore.delete(storeKey);
  }
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const normalizeLoginIdentifier = (value = '') => String(value).trim().toLowerCase();

const validateImagePayload = (value) =>
  typeof value === 'string' && (value.startsWith('data:image/') || value.startsWith('http'));
const isDatabaseReady = () => mongoose.connection.readyState === 1;

exports.sendOTP = async (req, res) => {
  try {
    const { phone, country } = req.body;
    if (!phone || !country) {
      return res.status(400).json({ success: false, message: 'Phone and country required' });
    }
    if (!COUNTRIES[country]) {
      return res.status(400).json({ success: false, message: 'Unsupported country' });
    }

    const otp = generateOTP();
    await setCode('otp', phone, otp);

    if (process.env.NODE_ENV === 'development') {
      logger.info(`[DEV MODE] OTP generated for ${phone}: ${otp}`);
      return res.json({ success: true, message: 'OTP generated successfully', otp });
    }

    await sendSMS(phone, `Your CashFlawHubs verification code is: ${otp}. Valid for 5 minutes.`);
    logger.info(`OTP sent to ${phone}`);
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    logger.error(`sendOTP error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

exports.sendEmailVerification = async (req, res) => {
  try {
    const { email, firstName } = req.body;
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Valid email required' });
    }

    const existing = isDatabaseReady()
      ? await User.findOne({ email: email.toLowerCase() })
      : devAuthStore.findByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const code = generateOTP();
    await setCode('email_otp', email, code);
    await clearCode('email_verified', email);

    await sendEmail(
      email,
      'Verify your CashFlawHubs email',
      `<p>Hello ${firstName || 'there'},</p><p>Your CashFlawHubs verification code is <strong>${code}</strong>.</p><p>This code expires in 5 minutes.</p>`
    );

    if (process.env.NODE_ENV === 'development') {
      logger.info(`[DEV MODE] Email verification code for ${email}: ${code}`);
      return res.json({ success: true, message: 'Verification code generated', code });
    }

    res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    logger.error(`sendEmailVerification error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to send email verification code' });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and verification code required' });
    }

    const storedCode = await getCode('email_otp', email);
    if (!storedCode || storedCode !== code) {
      return res.status(400).json({ success: false, message: 'Invalid or expired email verification code' });
    }

    await clearCode('email_otp', email);
    await setCode('email_verified', email, 'true');

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    logger.error(`verifyEmail error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to verify email' });
  }
};

exports.register = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      country,
      password,
      referralCode,
      otp,
      idNumber,
      idDocumentImage,
      faceVerificationImage,
    } = req.body;

    if (!firstName || !lastName || !email || !phone || !country || !password || !otp) {
      return res.status(400).json({ success: false, message: 'Missing required registration fields' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }
    if (!COUNTRIES[country]) {
      return res.status(400).json({ success: false, message: 'Unsupported country' });
    }
    const storedOTP = await getCode('otp', phone);
    if (!storedOTP || storedOTP !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    let existingPhone;
    let existingEmail;
    let existingId = null;

    if (isDatabaseReady()) {
      const checks = [
        User.findOne({ phone }),
        User.findOne({ email: email.toLowerCase() }),
      ];

      if (idNumber) {
        checks.push(User.findOne({ idNumber }));
      }

      [existingPhone, existingEmail, existingId] = await Promise.all(checks);
    } else {
      existingPhone = devAuthStore.findByPhone(phone);
      existingEmail = devAuthStore.findByEmail(email);
      existingId = idNumber ? devAuthStore.findByIdNumber(idNumber) : null;
    }

    if (existingPhone) return res.status(409).json({ success: false, message: 'Phone number already registered' });
    if (existingEmail) return res.status(409).json({ success: false, message: 'Email already registered' });
    if (existingId) return res.status(409).json({ success: false, message: 'ID number already registered' });

    let referrer = null;
    if (referralCode) {
      referrer = isDatabaseReady()
        ? await User.findOne({ referralCode })
        : devAuthStore.findByReferralCode(referralCode);
    }

    const fullName = `${firstName} ${lastName}`.trim();
    const identityVerificationStatus =
      validateImagePayload(idDocumentImage) && validateImagePayload(faceVerificationImage) ? 'submitted' : 'pending';

    if (!isDatabaseReady()) {
      const user = await devAuthStore.createUser({
        firstName,
        lastName,
        name: fullName,
        email,
        phone,
        country,
        passwordHash: password,
        idNumber: idNumber || undefined,
        idDocumentImage: validateImagePayload(idDocumentImage) ? idDocumentImage : null,
        faceVerificationImage: validateImagePayload(faceVerificationImage) ? faceVerificationImage : null,
        identityVerificationStatus,
        referredBy: referrer ? referrer.referralCode : null,
        emailVerified: true,
        phoneVerified: true,
      });

      await clearCode('otp', phone);
      const token = signToken(user.id);
      logger.warn(`MongoDB unavailable. Registered ${user.userId} using local development auth storage.`);

      return res.status(201).json({
        success: true,
        message: 'Registration successful',
        token,
        user: {
          ...user,
          paymentProvider: COUNTRIES[user.country]?.paymentProvider || null,
          paymentRouting: COUNTRIES[user.country]?.paymentRouting || { deposits: [], withdrawals: [] },
          tokenPackages: TOKEN_PACKAGES,
        },
      });
    }

    const user = await User.create({
      firstName,
      lastName,
      name: fullName,
      email: email.toLowerCase(),
      phone,
      country,
      passwordHash: password,
      idNumber: idNumber || undefined,
      idDocumentImage: validateImagePayload(idDocumentImage) ? idDocumentImage : null,
      faceVerificationImage: validateImagePayload(faceVerificationImage) ? faceVerificationImage : null,
      identityVerificationStatus,
      referredBy: referrer ? referrer.referralCode : null,
      emailVerified: true,
      phoneVerified: true,
    });

    await Promise.all([
      Wallet.create({ userId: user._id }),
      clearCode('otp', phone),
    ]);

    const token = signToken(user._id);
    logger.info(`New user registered: ${user.userId} from ${country}`);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        userId: user.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        email: user.email,
        phone: user.phone,
        country: user.country,
        referralCode: user.referralCode,
        activationStatus: user.activationStatus,
        emailVerified: user.emailVerified,
        identityVerificationStatus: user.identityVerificationStatus,
        tokenBalance: user.tokenBalance,
        totalTokensPurchased: user.totalTokensPurchased,
        totalTokensSpent: user.totalTokensSpent,
        paymentProvider: COUNTRIES[user.country]?.paymentProvider || null,
        paymentRouting: COUNTRIES[user.country]?.paymentRouting || { deposits: [], withdrawals: [] },
        tokenPackages: TOKEN_PACKAGES,
        role: user.role,
        level: user.level,
      },
    });
  } catch (error) {
    logger.error(`register error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, phone, email, password } = req.body;
    const rawIdentifier = identifier || email || phone;
    if (!rawIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Email or phone and password required' });
    }

    const trimmedIdentifier = String(rawIdentifier).trim();
    const query = isValidEmail(trimmedIdentifier)
      ? { email: normalizeLoginIdentifier(trimmedIdentifier) }
      : { phone: trimmedIdentifier };

    if (!isDatabaseReady()) {
      const user = isValidEmail(trimmedIdentifier)
        ? devAuthStore.findByEmail(trimmedIdentifier)
        : devAuthStore.findByPhone(trimmedIdentifier);
      if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

      if (!user.isActive || user.isBanned) {
        return res.status(403).json({ success: false, message: 'Account suspended. Contact support.' });
      }

      if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
        return res.status(429).json({ success: false, message: 'Account temporarily locked. Try again later.' });
      }

      const isMatch = await devAuthStore.verifyPassword(user, password);
      if (!isMatch) {
        devAuthStore.updateUser(user.id, (currentUser) => {
          const failedLoginAttempts = (currentUser.failedLoginAttempts || 0) + 1;
          return {
            ...currentUser,
            failedLoginAttempts,
            lockUntil: failedLoginAttempts >= 5 ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null,
          };
        });
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }

      const refreshedUser = devAuthStore.updateUser(user.id, (currentUser) => ({
        ...currentUser,
        failedLoginAttempts: 0,
        lockUntil: null,
        lastActiveDate: new Date().toISOString(),
        streak: currentUser.streak ? currentUser.streak + 1 : 1,
      })) || user;

      const token = signToken(refreshedUser.id);
      return res.json({
        success: true,
        token,
        user: {
          ...refreshedUser,
          paymentProvider: COUNTRIES[refreshedUser.country]?.paymentProvider || null,
          paymentRouting: COUNTRIES[refreshedUser.country]?.paymentRouting || { deposits: [], withdrawals: [] },
          tokenPackages: TOKEN_PACKAGES,
        },
      });
    }

    const user = await User.findOne(query).select('+passwordHash');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    if (user.isBanned) return res.status(403).json({ success: false, message: 'Account suspended. Contact support.' });

    if (user.lockUntil && user.lockUntil > Date.now()) {
      return res.status(429).json({ success: false, message: 'Account temporarily locked. Try again later.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= 5) {
        user.lockUntil = new Date(Date.now() + 30 * 60 * 1000);
      }
      await user.save();
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

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
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        email: user.email,
        phone: user.phone,
        country: user.country,
        referralCode: user.referralCode,
        activationStatus: user.activationStatus,
        identityVerificationStatus: user.identityVerificationStatus,
        tokenBalance: user.tokenBalance,
        totalTokensPurchased: user.totalTokensPurchased,
        totalTokensSpent: user.totalTokensSpent,
        paymentProvider: COUNTRIES[user.country]?.paymentProvider || null,
        paymentRouting: COUNTRIES[user.country]?.paymentRouting || { deposits: [], withdrawals: [] },
        tokenPackages: TOKEN_PACKAGES,
        role: user.role,
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

exports.getMe = async (req, res) => {
  try {
    if (!isDatabaseReady()) {
      const user = devAuthStore.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      return res.json({ success: true, user, wallet: { balanceUSD: user.balanceUSD || 0 } });
    }

    const user = await User.findById(req.user.id);
    const wallet = await Wallet.findOne({ userId: user._id });
    res.json({ success: true, user, wallet });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
