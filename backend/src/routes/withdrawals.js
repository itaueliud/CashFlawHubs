const express = require('express');
const router = express.Router();
const { requestWithdrawal, getWithdrawalHistory } = require('../controllers/withdrawalController');
const { protect, requireActivation } = require('../middleware/auth');

router.post('/request', protect, requireActivation, requestWithdrawal);
router.get('/history', protect, getWithdrawalHistory);

module.exports = router;
