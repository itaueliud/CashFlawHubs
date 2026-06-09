// routes/auth.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { sendOTP, sendEmailVerification, requestEmailVerification, verifyEmail, verifyEmailLink, verifyPhoneOTP, register, login, getMe, emailVerifiedStatus, logout, checkAvailability } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { ipMonitor } = require('../middleware/antiFraud');
const { verifyTurnstile } = require('../middleware/turnstile');

const buildAuthLimiter = (windowMs, max, message) =>
	rateLimit({
		windowMs,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		handler: (req, res) => res.status(429).json({ success: false, message }),
	});

const otpLimiter = buildAuthLimiter(
	15 * 60 * 1000,
	process.env.NODE_ENV === 'development' ? 20 : 5,
	'Too many OTP requests, please try again later.'
);

const verificationLimiter = buildAuthLimiter(
	15 * 60 * 1000,
	process.env.NODE_ENV === 'development' ? 20 : 10,
	'Too many verification requests, please try again later.'
);

const registerLimiter = buildAuthLimiter(
	15 * 60 * 1000,
	process.env.NODE_ENV === 'development' ? 20 : 6,
	'Too many registration attempts, please try again later.'
);

const loginLimiter = buildAuthLimiter(
	15 * 60 * 1000,
	process.env.NODE_ENV === 'development' ? 40 : 10,
	'Too many login attempts, please try again later.'
);

router.post('/send-otp', otpLimiter, verifyTurnstile, sendOTP);
router.post('/send-email-verification', verificationLimiter, verifyTurnstile, sendEmailVerification);
router.post('/request-email-verification', protect, requestEmailVerification);
router.post('/verify-email', verificationLimiter, verifyEmail);
router.get('/verify-email-link', verifyEmailLink);
router.get('/email-verified-status', emailVerifiedStatus);
router.post('/verify-phone-otp', verificationLimiter, verifyPhoneOTP);
router.post('/check-availability', checkAvailability);
router.post('/register', registerLimiter, verifyTurnstile, ipMonitor, register);
router.post('/login', loginLimiter, verifyTurnstile, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);

module.exports = router;
