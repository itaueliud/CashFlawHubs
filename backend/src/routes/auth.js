// routes/auth.js
const express = require('express');
const router = express.Router();
const { sendOTP, sendEmailVerification, verifyEmail, register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { ipMonitor } = require('../middleware/antiFraud');

router.post('/send-otp', sendOTP);
router.post('/send-email-verification', sendEmailVerification);
router.post('/verify-email', verifyEmail);
router.post('/register', ipMonitor, register);
router.post('/login', login);
router.get('/me', protect, getMe);

module.exports = router;
