const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { requestWithdrawal, getWithdrawalHistory } = require('../controllers/withdrawalController');
const { protect, requireActivation } = require('../middleware/auth');
const { verifyTurnstile } = require('../middleware/turnstile');

const buildLimiter = (windowMs, max, message) =>
	rateLimit({
		windowMs,
		max,
		standardHeaders: true,
		legacyHeaders: false,
		handler: (req, res) => res.status(429).json({ success: false, message }),
	});

const withdrawalLimiter = buildLimiter(
	15 * 60 * 1000,
	process.env.NODE_ENV === 'development' ? 20 : 6,
	'Too many withdrawal attempts, please try again later.'
);

router.post('/request', withdrawalLimiter, verifyTurnstile, protect, requireActivation, requestWithdrawal);
router.get('/history', protect, getWithdrawalHistory);

module.exports = router;
