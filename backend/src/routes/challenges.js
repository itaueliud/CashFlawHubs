const express = require('express');
const router = express.Router();
const { getDailyChallenges, claimChallengeReward } = require('../controllers/challengeController');
const { protect } = require('../middleware/auth');

router.get('/daily', protect, getDailyChallenges);
router.post('/:id/claim', protect, claimChallengeReward);

module.exports = router;
