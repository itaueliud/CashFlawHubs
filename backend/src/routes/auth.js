// routes/auth.js
const express = require('express');
const router = express.Router();
const { sendOTP, register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { ipMonitor } = require('../middleware/antiFraud');

router.post('/send-otp', sendOTP);
router.post('/register', ipMonitor, register);
router.post('/login', login);
router.get('/me', protect, getMe);

module.exports = router;
