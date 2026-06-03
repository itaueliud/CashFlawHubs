const express = require('express');
const router = express.Router();
const { protect, requireActivation, requireTestUserActionAccess } = require('../middleware/auth');
const { getAdsNetworkProviders, launchAdsProvider, getAdsNetworkHistory } = require('../controllers/adsNetworkController');

router.get('/providers', protect, requireActivation, getAdsNetworkProviders);
router.get('/launch/:providerKey', protect, requireActivation, requireTestUserActionAccess('Ads / Ad Network'), launchAdsProvider);
router.get('/history', protect, requireActivation, getAdsNetworkHistory);

module.exports = router;
