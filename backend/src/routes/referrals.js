const express = require('express');
const router = express.Router();
const { getReferralDashboard, getLeaderboard, validateReferralCode } = require('../controllers/referralController');
const { protect } = require('../middleware/auth');

router.get('/dashboard', protect, getReferralDashboard);
router.get('/leaderboard', getLeaderboard);
router.get('/validate/:code', validateReferralCode);

module.exports = router;
