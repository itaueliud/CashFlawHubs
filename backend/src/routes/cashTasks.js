const express = require('express');
const router = express.Router();
const { protect, requireActivation } = require('../middleware/auth');
const { getCashTaskProviders, launchCashTaskProvider, getCashTaskHistory } = require('../controllers/cashTaskController');

router.get('/providers', protect, requireActivation, getCashTaskProviders);
router.get('/launch/:providerKey', protect, requireActivation, launchCashTaskProvider);
router.get('/history', protect, requireActivation, getCashTaskHistory);

module.exports = router;