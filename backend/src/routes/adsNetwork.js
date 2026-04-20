const express = require('express');
const router = express.Router();
const { protect, requireActivation } = require('../middleware/auth');
const { getAdsNetworkProviders } = require('../controllers/adsNetworkController');

router.get('/providers', protect, requireActivation, getAdsNetworkProviders);

module.exports = router;
