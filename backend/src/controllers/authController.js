const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const { getRedis } = require('../config/redis');
const PortalAudit = require('../models/PortalAudit');
const logger = require('../utils/logger');
const {
  sendSMS,
  sendVerificationSMS,
  smsConfigured,
  verificationSmsConfigured,
  sendgridClient,
} = require('../services/notificationService');
const { COUNTRIES } = require('../config/countries');
const { TOKEN_PACKAGES } = require('../config/monetization');
const devAuthStore = require('../services/devAuthStore');
const { isUserActivated } = require('../utils/activationWindow');
const { trackEvent } = require('../services/eventTracker');
const { sendVerificationEmail } = require('../services/emailService');

const CODE_TTL_SECONDS = 300;
const EMAIL_VERIFY_TTL_SECONDS = 24 * 60 * 60;
const TWO_FACTOR_LOGIN_TTL_SECONDS = 10 * 60;
const fallbackStore = new Map();

const signToken = (userId, portal = '') =>
  jwt.sign({ id: userId, portal: String(portal || '').toLowerCase().trim() }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

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

const setLoginChallenge = async (challengeId, payload, ttlSeconds = TWO_FACTOR_LOGIN_TTL_SECONDS) => {
  await setCode('2fa-login', challengeId, JSON.stringify(payload), ttlSeconds);
};

const getLoginChallenge = async (challengeId) => {
  const raw = await getCode('2fa-login', challengeId);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const clearLoginChallenge = async (challengeId) => {
  await clearCode('2fa-login', challengeId);
};

const verifyTwoFactorTokenForUser = async (userRecord, token) => {
  const cleanToken = String(token || '').replace(/\s/g, '');
  if (!cleanToken) return { valid: false, reason: 'Token is required' };

  const secret = String(userRecord?.twoFactorSecret || '').trim();
  if (!secret) return { valid: false, reason: '2FA not enabled' };

  const speakeasy = require('speakeasy');
  const crypto = require('crypto');
  const totpValid = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: cleanToken,
    window: 1,
  });
  if (totpValid) return { valid: true };

  const hashedAttempt = crypto.createHash('sha256').update(cleanToken.toUpperCase()).digest('hex');
  const backupCodes = Array.isArray(userRecord?.twoFactorBackupCodes) ? userRecord.twoFactorBackupCodes : [];
  const backupIndex = backupCodes.indexOf(hashedAttempt);
  if (backupIndex !== -1) {
    return { valid: true, usedBackupCode: true, backupIndex };
  }

  return { valid: false, reason: 'Invalid code' };
};

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const PHONE_RULES = {
  '+254': 9,   // Kenya
  '+256': 9,   // Uganda
  '+255': 9,   // Tanzania
  '+251': 9,   // Ethiopia
  '+233': 9,   // Ghana
  '+234': 10,  // Nigeria
};

function validatePhoneForCountry(fullPhone) {
  for (const [dialCode, expectedDigits] of Object.entries(PHONE_RULES)) {
    if (fullPhone.startsWith(dialCode)) {
      const localPart = fullPhone.slice(dialCode.length);
      if (!/^\d+$/.test(localPart)) return { valid: false, message: 'Phone number must contain digits only' };
      if (localPart.length !== expectedDigits) {
        return { valid: false, message: `Phone numbers for this country must be ${expectedDigits} digits after the country code` };
      }
      return { valid: true };
    }
  }
  return { valid: false, message: 'Unsupported country code' };
}

const isNumericIdentityNumber = (value = '') => /^\d+$/.test(String(value).trim());
const isStrongPassword = (value = '') => {
  const password = String(value || '');
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
};
const normalizeLoginIdentifier = (value = '') => String(value).trim().toLowerCase();
const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
const getApiBaseUrl = () =>
  (process.env.API_BASE_URL || process.env.BACKEND_URL || 'http://localhost:5000').replace(/\/+$/, '');
const getFrontendBaseUrl = () =>
  (process.env.FRONTEND_URL || process.env.FRONTEND_APP_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: (Number(process.env.JWT_COOKIE_MAX_AGE_DAYS || 7) || 7) * 24 * 60 * 60 * 1000,
});
const setAuthCookie = (res, token) => res.cookie('token', token, getAuthCookieOptions());
const clearAuthCookie = (res) => res.clearCookie('token', { path: '/' });

const validateImagePayload = (value) =>
  typeof value === 'string' && (value.startsWith('data:image/') || value.startsWith('http'));
const isDatabaseReady = () => mongoose.connection.readyState === 1;
const normalizeLang = (raw = '') => String(raw || 'en').split(',')[0].trim().split('-')[0].toLowerCase() || 'en';
const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
};
const getSecurityContext = (req, payload = {}) => ({
  ipAddress: getClientIp(req),
  userAgent: String(req.headers['user-agent'] || ''),
  acceptLanguage: String(req.headers['accept-language'] || ''),
  browserLanguage: String(payload.browser_language || ''),
  userLanguage: normalizeLang(payload.user_language || payload.browser_language || req.headers['accept-language'] || 'en'),
  cfIpCountry: String(req.headers['cf-ipcountry'] || ''),
  timezone: String(payload.timezone || req.headers['x-timezone'] || ''),
  deviceFingerprint: crypto
    .createHash('sha256')
    .update([
      getClientIp(req),
      String(req.headers['user-agent'] || ''),
      String(req.headers['accept-language'] || ''),
      String(payload.timezone || req.headers['x-timezone'] || ''),
    ].join('|'))
    .digest('hex')
    .slice(0, 64),
});

const sendVerificationEmailToRecipient = async ({ email, firstName, allowExistingUser = false }) => {
  if (!email || !isValidEmail(email)) {
    const error = new Error('Valid email required');
    error.status = 400;
    throw error;
  }

  const normalizedEmail = normalizeEmail(email);

  if (!allowExistingUser) {
    const existing = isDatabaseReady()
      ? await User.findOne({ email: normalizedEmail })
      : devAuthStore.findByEmail(normalizedEmail);
    if (existing) {
      const error = new Error('Email already registered');
      error.status = 409;
      throw error;
    }
  }

  const token = crypto.randomBytes(32).toString('hex');
  await setCode('email_verify_token', token, normalizedEmail, EMAIL_VERIFY_TTL_SECONDS);
  await clearCode('email_verified', normalizedEmail);
  const verifyLink = `${getApiBaseUrl()}/api/auth/verify-email-link?token=${encodeURIComponent(token)}`;

  await sendgridClient.sendEmail({
    to: normalizedEmail,
    subject: 'Verify your CashFlawHubs email',
    html: `<p>Hello ${firstName || 'there'},</p><p>Click below to verify your CashFlawHubs email address:</p><p><a href="${verifyLink}">${verifyLink}</a></p><p>This link expires in 24 hours.</p>`,
  });

  return { normalizedEmail, verifyLink };
};

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

    if (process.env.NODE_ENV !== 'development' && !verificationSmsConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'SMS verification is not configured on this server',
      });
    }

    if (process.env.NODE_ENV === 'development' || !verificationSmsConfigured()) {
      if (!verificationSmsConfigured()) {
        logger.warn(`Infobip 2FA provider not configured. Returning OTP directly for ${phone}.`);
      }
      logger.info(`[DEV MODE] OTP generated for ${phone}: ${otp}`);
      return res.json({
        success: true,
        message: verificationSmsConfigured()
          ? 'OTP generated successfully'
          : 'Infobip not configured. OTP generated directly.',
        otp,
      });
    }

    const { pinId } = await sendVerificationSMS(phone);
    if (!pinId) {
      throw new Error('Failed to receive pinId from Infobip');
    }

    await setCode('infobip_pin', phone, pinId);
    logger.info(`OTP request registered for ${phone}`);
    res.json({ success: true, message: 'OTP sent successfully' });
  } catch (error) {
    logger.error(`sendOTP error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
};

exports.sendEmailVerification = async (req, res) => {
  try {
    const { email, firstName } = req.body;
    const { verifyLink, normalizedEmail } = await sendVerificationEmailToRecipient({ email, firstName, allowExistingUser: false });

    if (process.env.NODE_ENV === 'development') {
      logger.info(`[DEV MODE] Email verification link for ${normalizedEmail}: ${verifyLink}`);
      return res.json({ success: true, message: 'Verification link generated', verifyLink });
    }

    res.json({ success: true, message: 'Verification email sent. Open the link in your inbox.' });
  } catch (error) {
    logger.error(`sendEmailVerification error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to send verification email' });
  }
};

exports.requestEmailVerification = async (req, res) => {
  try {
    const user = isDatabaseReady()
      ? await User.findById(req.user.id).select('email firstName name')
      : devAuthStore.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!user.email) {
      return res.status(400).json({ success: false, message: 'No email address on file' });
    }

    const { verifyLink, normalizedEmail } = await sendVerificationEmailToRecipient({
      email: user.email,
      firstName: user.firstName || user.name || 'there',
      allowExistingUser: true,
    });

    if (process.env.NODE_ENV === 'development') {
      logger.info(`[DEV MODE] Email verification link for ${normalizedEmail}: ${verifyLink}`);
      return res.json({ success: true, message: 'Verification link generated', verifyLink });
    }

    return res.json({ success: true, message: 'Verification email sent. Open the link in your inbox.' });
  } catch (error) {
    logger.error(`requestEmailVerification error: ${error.message}`);
    res.status(error.status || 500).json({ success: false, message: error.message || 'Failed to send verification email' });
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

exports.verifyEmailLink = async (req, res) => {
  const redirectBase = getFrontendBaseUrl();
  try {
    const token = String(req.query.token || '').trim();
    if (!token) {
      return res.redirect(`${redirectBase}/register?step=4&emailVerified=0&reason=missing_token`);
    }

    const email = await getCode('email_verify_token', token);
    if (!email) {
      return res.redirect(`${redirectBase}/register?step=4&emailVerified=0&reason=invalid_or_expired`);
    }

    const normalizedEmail = normalizeEmail(email);
    await clearCode('email_verify_token', token);
    await setCode('email_verified', normalizedEmail, 'true');

    return res.redirect(`${redirectBase}/register?step=4&emailVerified=1&email=${encodeURIComponent(normalizedEmail)}`);
  } catch (error) {
    logger.error(`verifyEmailLink error: ${error.message}`);
    return res.redirect(`${redirectBase}/register?step=4&emailVerified=0&reason=server_error`);
  }
};

// @GET /api/auth/email-verified-status?email=...
exports.emailVerifiedStatus = async (req, res) => {
  try {
    const email = String(req.query.email || '').trim();
    if (!email) return res.status(400).json({ success: false, message: 'Email required' });
    const normalizedEmail = normalizeEmail(email);
    const verified = (await getCode('email_verified', normalizedEmail)) === 'true';
    return res.json({ success: true, verified });
  } catch (error) {
    logger.error(`emailVerifiedStatus error: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to check email verified status' });
  }
};

exports.verifyPhoneOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone and OTP required' });
    }

    if (process.env.NODE_ENV !== 'development' && !verificationSmsConfigured()) {
      return res.status(503).json({
        success: false,
        message: 'SMS verification is not configured on this server',
      });
    }

    const useInfobip = process.env.NODE_ENV !== 'development' && verificationSmsConfigured();
    if (!useInfobip) {
      const storedCode = await getCode('otp', phone);
      if (!storedCode || storedCode !== String(otp)) {
        return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
      }
      await clearCode('otp', phone);
      await setCode('phone_verified', phone, 'true');
      return res.json({ success: true, message: 'Phone verified successfully' });
    }

    const pinId = await getCode('infobip_pin', phone);
    if (!pinId) {
      return res.status(400).json({ success: false, message: 'OTP session expired or invalid phone' });
    }

    const apiUrl = (process.env.INFOBIP_BASE_URL || 'https://api.infobip.com').replace(/\/+$/, '');
    const response = await axios.post(
      `${apiUrl}/2fa/2/pin/${encodeURIComponent(pinId)}/verify`,
      { pin: otp },
      {
        headers: {
          Authorization: `App ${process.env.INFOBIP_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 15000,
      }
    );

    if (!response.data?.verified) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    await clearCode('infobip_pin', phone);
    await setCode('phone_verified', phone, 'true');
    return res.json({ success: true, message: 'Phone verified successfully' });
  } catch (error) {
    logger.error(`verifyPhoneOTP error: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Failed to verify phone OTP' });
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
      confirmPassword,
      referralCode,
      idNumber,
      termsAccepted,
      dateOfBirth,
      idDocumentImage,
      faceVerificationImage,
      browser_language,
      user_language,
      timezone,
      device_fingerprint,
    } = req.body;

    if (!firstName || !lastName || !email || !country || !password) {
      return res.status(400).json({ success: false, message: 'Missing required registration fields' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, message: 'Enter a valid email address' });
    }
    if (!COUNTRIES[country]) {
      return res.status(400).json({ success: false, message: 'Unsupported country' });
    }
    if (idNumber && !isNumericIdentityNumber(idNumber)) {
      return res.status(400).json({ success: false, message: 'ID number must contain numbers only' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters and include letters, numbers, and symbols' });
    }
    if (!confirmPassword || confirmPassword !== password) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }
    if (!termsAccepted) {
      return res.status(400).json({ success: false, message: 'You must accept the terms and conditions' });
    }
    if (!referralCode) {
      return res.status(400).json({ success: false, message: 'Referral code is required' });
    }
    const normalizedPhone = String(phone || '').trim();
    const phoneCheck = validatePhoneForCountry(normalizedPhone);
    if (!phoneCheck.valid) {
      return res.status(400).json({ success: false, message: phoneCheck.message });
    }
    const normalizedEmail = normalizeEmail(email);
    // Phone verification is optional during registration: do not block account creation
    // if the phone OTP hasn't been verified. We still accept and store the phone if provided.
    const emailVerified = (await getCode('email_verified', normalizedEmail)) === 'true';
    let existingPhone;
    let existingEmail;
    let existingId = null;

    if (isDatabaseReady()) {
      const phoneQuery = normalizedPhone ? User.findOne({ phone: normalizedPhone }) : Promise.resolve(null);
      const emailQuery = User.findOne({ email: normalizedEmail });
      const idQuery = idNumber ? User.findOne({ idNumber: String(idNumber).trim() }) : Promise.resolve(null);

      [existingPhone, existingEmail, existingId] = await Promise.all([phoneQuery, emailQuery, idQuery]);
    } else {
      existingPhone = normalizedPhone ? devAuthStore.findByPhone(normalizedPhone) : null;
      existingEmail = devAuthStore.findByEmail(normalizedEmail);
      existingId = idNumber ? devAuthStore.findByIdNumber(String(idNumber).trim()) : null;
    }

    if (existingPhone) return res.status(409).json({ success: false, message: 'Phone number already registered' });
    if (existingEmail) return res.status(409).json({ success: false, message: 'Email already registered' });
    if (existingId) return res.status(409).json({ success: false, message: 'ID number already registered' });

    let referrer = null;
    if (isDatabaseReady()) {
      referrer = await User.findOne({ referralCode });
      if (!referrer) {
        // Fallback to dev auth store if MongoDB doesn't contain the referral (useful for local dev helpers)
        const devRef = devAuthStore.findByReferralCode(referralCode);
        if (devRef) {
          referrer = devRef;
        }
      }
    } else {
      referrer = devAuthStore.findByReferralCode(referralCode);
    }
    if (!referrer) {
      return res.status(400).json({ success: false, message: 'Invalid referral code' });
    }
    const securityContext = getSecurityContext(req, { browser_language, user_language, timezone, device_fingerprint });

    const fullName = `${firstName} ${lastName}`.trim();
    const identityVerificationStatus =
      validateImagePayload(idDocumentImage) && validateImagePayload(faceVerificationImage) ? 'submitted' : 'pending';

    if (!isDatabaseReady()) {
      const user = await devAuthStore.createUser({
        firstName,
        lastName,
        name: fullName,
        email: normalizedEmail,
        phone: normalizedPhone || undefined,
        country,
        passwordHash: password,
        idNumber: idNumber || undefined,
        idDocumentImage: validateImagePayload(idDocumentImage) ? idDocumentImage : null,
        faceVerificationImage: validateImagePayload(faceVerificationImage) ? faceVerificationImage : null,
        identityVerificationStatus,
        referredBy: referrer ? referrer.referralCode : null,
        emailVerified,
        phoneVerified: false,
        dateOfBirth: dateOfBirth || null,
        browserLanguage: securityContext.browserLanguage || normalizeLang(securityContext.acceptLanguage),
        userLanguage: securityContext.userLanguage,
        lastAcceptLanguage: securityContext.acceptLanguage,
        timezone: securityContext.timezone,
      });

      const token = signToken(user.id);
      setAuthCookie(res, token);
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
      email: normalizedEmail,
      ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      country,
      passwordHash: password,
      idNumber: idNumber ? String(idNumber).trim() : undefined,
      idDocumentImage: validateImagePayload(idDocumentImage) ? idDocumentImage : null,
      faceVerificationImage: validateImagePayload(faceVerificationImage) ? faceVerificationImage : null,
      identityVerificationStatus,
      referredBy: referrer ? referrer.referralCode : null,
      emailVerified,
      phoneVerified: false,
      dateOfBirth: dateOfBirth || null,
      browserLanguage: securityContext.browserLanguage || normalizeLang(securityContext.acceptLanguage),
      userLanguage: securityContext.userLanguage,
      lastAcceptLanguage: securityContext.acceptLanguage,
      timezone: securityContext.timezone,
      registrationContext: {
        ...securityContext,
        registeredAt: new Date(),
      },
      securityEvents: [{
        ...securityContext,
        eventType: 'registration',
      }],
    });
    if (normalizedPhone) {
      await clearCode('phone_verified', normalizedPhone);
    }

    if (!user.emailVerified && user.email) {
      const emailToken = crypto.randomBytes(32).toString('hex');
      user.emailVerificationToken = emailToken;
      user.emailVerificationExpiry = Date.now() + 24 * 60 * 60 * 1000;
      await user.save();
      sendVerificationEmail(user.email, user.firstName, emailToken).catch(e => logger.error('Email failed: ' + e.message));
    }

    await Wallet.create({ userId: user._id });

    if (referrer) {
      const { updateChallengeProgress } = require('./challengeController');
      await updateChallengeProgress(referrer._id, 'referral');
    }

    const token = signToken(user._id);
    setAuthCookie(res, token);
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
        dateOfBirth: user.dateOfBirth,
        referralCode: user.referralCode,
        userLanguage: user.userLanguage,
        browserLanguage: user.browserLanguage,
        activationStatus: isUserActivated(user),
        activationStatusRaw: user.activationStatus,
        emailVerified: user.emailVerified,
        identityVerificationStatus: user.identityVerificationStatus,
        tokenBalance: user.tokenBalance,
        totalTokensPurchased: user.totalTokensPurchased,
        totalTokensSpent: user.totalTokensSpent,
        paymentProvider: COUNTRIES[user.country]?.paymentProvider || null,
        paymentRouting: COUNTRIES[user.country]?.paymentRouting || { deposits: [], withdrawals: [] },
        tokenPackages: TOKEN_PACKAGES,
        role: user.role,
        userAccessType: user.userAccessType || 'real',
        level: user.level,
        managedBy: user.managedBy || null,
      },
    });
  } catch (error) {
    logger.error(`register error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const {
      identifier,
      phone,
      email,
      password,
      browser_language,
      user_language,
      timezone,
      device_fingerprint,
      portal,
      twoFactorToken,
      twoFactorChallengeId,
    } = req.body;
    // `portal` is intentionally allowed to be empty string for the user portal
    const portalValue = String(portal || '').toLowerCase().trim(); // '' | 'admin' | 'ledger' | 'superadmin'
    const normalizedPortal = portalValue || 'user';
    const rawIdentifier = identifier || email || phone;
    if (!rawIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Email or phone and password required' });
    }

    const trimmedIdentifier = String(rawIdentifier).trim();
    const normalizePhoneForLookup = (p) => {
      const digits = p.replace(/[^\d]/g, '');
      return { $in: [p, `+${digits}`, digits] };
    };

    const query = isValidEmail(trimmedIdentifier)
      ? { email: normalizeLoginIdentifier(trimmedIdentifier) }
      : { phone: normalizePhoneForLookup(trimmedIdentifier) };

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

      // ─── PORTAL ENFORCEMENT (dev fallback) ──────────────────────────────────
      // Define which roles belong to which portal
      const PORTAL_ROLES = {
        admin:      ['admin'],
        ledger:     ['ledger'],
        superadmin: ['superadmin'],
        '':         ['user'], // empty = user portal
      };

      const userRoleDev = String(refreshedUser.role || 'user').toLowerCase();

      if (portalValue) {
        // Staff portal: only the matching role is allowed
        const allowedRoles = PORTAL_ROLES[portalValue] || [];
        if (!allowedRoles.includes(userRoleDev)) {
          // Redact identifier for logs
          const idForLog = refreshedUser.email || refreshedUser.phone || refreshedUser.userId || refreshedUser.id;
          const redacted = String(idForLog || '').replace(/.(?=.{2})/g, '*');
          const sec = getSecurityContext(req);
          logger.warn(`Portal mismatch login attempt (dev): portal=${portalValue} userRole=${userRoleDev} identifier=${redacted} ip=${sec.ipAddress}`);
          try {
            await PortalAudit.create({
              type: 'portal_mismatch',
              portalAttempted: portalValue,
              userRole: userRoleDev,
              identifierRedacted: redacted,
              ipAddress: sec.ipAddress,
              userAgent: String(req.headers['user-agent'] || ''),
            });
          } catch (e) {
            logger.warn(`Failed to record portal audit (dev): ${e.message}`);
          }
          return res.status(403).json({
            success: false,
            message: 'Access denied. You do not have permission to access this portal.',
          });
        }
      } else {
        // User portal: staff roles must NOT log in here
        const staffRoles = ['admin', 'superadmin', 'ledger'];
        if (staffRoles.includes(userRoleDev)) {
          const idForLog = refreshedUser.email || refreshedUser.phone || refreshedUser.userId || refreshedUser.id;
          const redacted = String(idForLog || '').replace(/.(?=.{2})/g, '*');
          const sec = getSecurityContext(req);
          logger.warn(`Staff login blocked on user portal (dev): role=${userRoleDev} identifier=${redacted} ip=${sec.ipAddress}`);
          try {
            await PortalAudit.create({
              type: 'portal_mismatch',
              portalAttempted: 'user',
              userRole: userRoleDev,
              identifierRedacted: redacted,
              ipAddress: sec.ipAddress,
              userAgent: String(req.headers['user-agent'] || ''),
            });
          } catch (e) {
            logger.warn(`Failed to record portal audit (dev): ${e.message}`);
          }
          return res.status(403).json({
            success: false,
            message: 'Staff accounts must log in through the dedicated staff portal.',
          });
        }
      }

      if (refreshedUser.twoFactorEnabled) {
        const challengePayload = twoFactorChallengeId ? await getLoginChallenge(twoFactorChallengeId) : null;
        if (!twoFactorToken || !twoFactorChallengeId) {
          const challengeId = crypto.randomUUID();
          await setLoginChallenge(challengeId, {
            userId: String(refreshedUser.id || refreshedUser._id || ''),
            portal: portalValue || '',
          });
          return res.json({
            success: true,
            requires2FA: true,
            challengeId,
            userId: refreshedUser.id,
            message: 'Enter your 6-digit authenticator code',
          });
        }

        if (!challengePayload || String(challengePayload.userId) !== String(refreshedUser.id || refreshedUser._id || '')) {
          return res.status(401).json({ success: false, message: '2FA challenge expired. Please log in again.' });
        }

        const verificationTarget = refreshedUser.twoFactorSecret ? refreshedUser : await devAuthStore.findById(refreshedUser.id);
        const verification = await verifyTwoFactorTokenForUser(verificationTarget, twoFactorToken);
        if (!verification.valid) {
          return res.status(401).json({ success: false, message: verification.reason || 'Invalid code' });
        }

        if (verification.usedBackupCode && Array.isArray(refreshedUser.twoFactorBackupCodes)) {
          refreshedUser.twoFactorBackupCodes.splice(verification.backupIndex, 1);
          if (typeof refreshedUser.save === 'function') {
            await refreshedUser.save();
          } else if (refreshedUser.id) {
            devAuthStore.updateUser(refreshedUser.id, (currentUser) => {
              const backupCodes = Array.isArray(currentUser.twoFactorBackupCodes) ? [...currentUser.twoFactorBackupCodes] : [];
              backupCodes.splice(verification.backupIndex, 1);
              return { ...currentUser, twoFactorBackupCodes: backupCodes };
            });
          }
        }

        await clearLoginChallenge(twoFactorChallengeId);
      }

      const token = signToken(refreshedUser.id, portalValue || '');
      setAuthCookie(res, token);
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

    // ─── PORTAL ENFORCEMENT ───────────────────────────────────────────────────
    // Define which roles belong to which portal
    const PORTAL_ROLES = {
      admin:      ['admin'],
      ledger:     ['ledger'],
      superadmin: ['superadmin'],
      '':         ['user'], // empty = user portal
    };

    const userRole = String(user.role || 'user').toLowerCase();

    if (portalValue) {
      const allowedRoles = PORTAL_ROLES[portalValue] || [];
      if (!allowedRoles.includes(userRole)) {
        const idForLog = user.email || user.phone || user.userId || user._id;
        const redacted = String(idForLog || '').replace(/.(?=.{2})/g, '*');
        const sec = getSecurityContext(req);
        logger.warn(`Portal mismatch login attempt: portal=${portalValue} userRole=${userRole} identifier=${redacted} ip=${sec.ipAddress}`);
        try {
          await PortalAudit.create({
            type: 'portal_mismatch',
            portalAttempted: portalValue,
            userRole,
            identifierRedacted: redacted,
            ipAddress: sec.ipAddress,
            userAgent: String(req.headers['user-agent'] || ''),
          });
        } catch (e) {
          logger.warn(`Failed to record portal audit: ${e.message}`);
        }
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not have permission to access this portal.',
        });
      }
    } else {
      const staffRoles = ['admin', 'superadmin', 'ledger'];
      if (staffRoles.includes(userRole)) {
        const idForLog = user.email || user.phone || user.userId || user._id;
        const redacted = String(idForLog || '').replace(/.(?=.{2})/g, '*');
        const sec = getSecurityContext(req);
        logger.warn(`Staff login blocked on user portal: role=${userRole} identifier=${redacted} ip=${sec.ipAddress}`);
        try {
          await PortalAudit.create({
            type: 'portal_mismatch',
            portalAttempted: 'user',
            userRole,
            identifierRedacted: redacted,
            ipAddress: sec.ipAddress,
            userAgent: String(req.headers['user-agent'] || ''),
          });
        } catch (e) {
          logger.warn(`Failed to record portal audit: ${e.message}`);
        }
        return res.status(403).json({
          success: false,
          message: 'Staff accounts must log in through the dedicated staff portal.',
        });
      }
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    user.updateStreak();
    const securityContext = getSecurityContext(req, { browser_language, user_language, timezone, device_fingerprint });
    user.browserLanguage = securityContext.browserLanguage || user.browserLanguage;
    user.lastAcceptLanguage = securityContext.acceptLanguage;
    user.timezone = securityContext.timezone || user.timezone;
    if (!user.userLanguage || !String(user.userLanguage).trim()) {
      user.userLanguage = securityContext.userLanguage;
    }
    user.securityEvents = [...(user.securityEvents || []), {
      ...securityContext,
      eventType: 'login',
    }].slice(-30);
    await user.save();

    const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const loginHistory = Array.isArray(user.loginHistory) ? [...user.loginHistory] : [];
    const todayLogins = loginHistory.filter((l) => new Date(l.timestamp) >= startOfDay);
    const lastCounted = todayLogins.filter((l) => l.countedForChallenge).slice(-1)[0];
    const canCount = !lastCounted || (now - new Date(lastCounted.timestamp)) >= FOUR_HOURS_MS;
    if (canCount) {
      loginHistory.push({ timestamp: now, countedForChallenge: true });
      await User.findByIdAndUpdate(user._id, { $set: { loginHistory } });
      const { updateChallengeProgress } = require('./challengeController');
      await updateChallengeProgress(user._id, 'login');
    }

    await trackEvent(user._id, 'login');
    if (user.streak === 3) await trackEvent(user._id, 'daily_login_streak_3');
    if (user.streak === 7) await trackEvent(user._id, 'daily_login_streak_7');
    if (user.streak === 14) await trackEvent(user._id, 'login_streak_14');
    if (user.streak === 30) await trackEvent(user._id, 'login_streak_30');

    if (user.twoFactorEnabled) {
      const challengePayload = twoFactorChallengeId ? await getLoginChallenge(twoFactorChallengeId) : null;
      if (!twoFactorToken || !twoFactorChallengeId) {
        const challengeId = crypto.randomUUID();
        await setLoginChallenge(challengeId, {
          userId: String(user._id),
          portal: portalValue || '',
        });
        return res.json({
          success: true,
          requires2FA: true,
          challengeId,
          userId: user._id.toString(),
          message: 'Enter your 6-digit authenticator code',
        });
      }

      if (!challengePayload || String(challengePayload.userId) !== String(user._id)) {
        return res.status(401).json({ success: false, message: '2FA challenge expired. Please log in again.' });
      }

      const userWith2FA = await User.findById(user._id).select('+twoFactorSecret +twoFactorBackupCodes');
      const verification = await verifyTwoFactorTokenForUser(userWith2FA, twoFactorToken);
      if (!verification.valid) {
        return res.status(401).json({ success: false, message: verification.reason || 'Invalid code' });
      }

      if (verification.usedBackupCode) {
        userWith2FA.twoFactorBackupCodes.splice(verification.backupIndex, 1);
        await userWith2FA.save();
      }

      await clearLoginChallenge(twoFactorChallengeId);
    }

    const token = signToken(user._id, portalValue || '');
    setAuthCookie(res, token);
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
        dateOfBirth: user.dateOfBirth,
        referralCode: user.referralCode,
        userLanguage: user.userLanguage,
        browserLanguage: user.browserLanguage,
        activationStatus: isUserActivated(user),
        activationStatusRaw: user.activationStatus,
        identityVerificationStatus: user.identityVerificationStatus,
        tokenBalance: user.tokenBalance,
        totalTokensPurchased: user.totalTokensPurchased,
        totalTokensSpent: user.totalTokensSpent,
        paymentProvider: COUNTRIES[user.country]?.paymentProvider || null,
        paymentRouting: COUNTRIES[user.country]?.paymentRouting || { deposits: [], withdrawals: [] },
        tokenPackages: TOKEN_PACKAGES,
        role: user.role,
        userAccessType: user.userAccessType || 'real',
        level: user.level,
        xpPoints: user.xpPoints,
        streak: user.streak,
        badges: user.badges,
        balanceUSD: wallet?.balanceUSD || 0,
        managedBy: user.managedBy || null,
      },
    });
  } catch (error) {
    logger.error(`login error: ${error.message}`);
    res.status(500).json({ success: false, message: 'Login failed' });
  }
};

exports.logout = async (req, res) => {
  try {
    // Attempt to blacklist current token (if present) so it cannot be reused
    let token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
    if (token) {
      try {
        const decoded = jwt.decode(token) || {};
        const exp = Number(decoded.exp || 0);
        const ttl = Math.max(0, Math.floor(exp - Date.now() / 1000));
        if (ttl > 0) {
          const redis = getRedis();
          try {
            await redis.setex(`blacklist:token:${token}`, ttl, '1');
          } catch (e) {
            // best-effort, do not fail logout because redis is down
            logger.warn(`Failed to write token blacklist entry: ${e.message}`);
          }
        }
      } catch (e) {
        logger.warn(`Failed to decode token for blacklist: ${e.message}`);
      }
    }
  } catch (e) {
    logger.warn(`Logout blacklist error: ${e.message}`);
  }

  clearAuthCookie(res);
  return res.json({ success: true, message: 'Logged out successfully' });
};

exports.getMe = async (req, res) => {
  try {
    if (!isDatabaseReady()) {
      const user = devAuthStore.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      return res.json({
        success: true,
        user: {
          ...user,
          activationStatus: isUserActivated(user),
          activationStatusRaw: user.activationStatus,
        },
        wallet: { balanceUSD: user.balanceUSD || 0 },
      });
    }

    const user = await User.findById(req.user.id);
    const wallet = await Wallet.findOne({ userId: user._id });
    res.json({
      success: true,
      user: {
        ...user.toObject(),
        id: user._id,
        _id: user._id,
        activationStatus: isUserActivated(user),
        activationStatusRaw: user.activationStatus,
      },
      wallet,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.checkAvailability = async (req, res) => {
  try {
    const { phone, email } = req.body;
    const result = {};

    if (phone) {
      const exists = isDatabaseReady()
        ? await User.findOne({ phone: phone.trim() })
        : devAuthStore.findByPhone(phone.trim());
      result.phoneAvailable = !exists;
    }
    if (email) {
      const exists = isDatabaseReady()
        ? await User.findOne({ email: email.toLowerCase().trim() })
        : devAuthStore.findByEmail(email.toLowerCase().trim());
      result.emailAvailable = !exists;
    }

    return res.json(result);
  } catch (err) {
    logger.error(`checkAvailability error: ${err.message}`);
    return res.status(500).json({ message: 'Server error' });
  }
};

// @POST /api/auth/resend-verification-email  (protected)
exports.resendVerificationEmail = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+emailVerificationToken +emailVerificationExpiry');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.emailVerified) return res.status(400).json({ success: false, message: 'Email already verified' });
    if (!user.email) return res.status(400).json({ success: false, message: 'No email on file' });

    const token = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = token;
    user.emailVerificationExpiry = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    await sendVerificationEmail(user.email, user.firstName || 'there', token);
    res.json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    logger.error(`resendVerificationEmail error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/auth/verify-email-token?token=...
exports.verifyEmailToken = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: 'Token is required' });

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpiry: { $gt: Date.now() },
    }).select('+emailVerificationToken +emailVerificationExpiry');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'This verification link has already been used or has expired. If your email is still unverified, please request a new verification link from your profile settings.',
      });
    }

    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;
    await user.save();

    res.json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    logger.error(`verifyEmailToken error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};
