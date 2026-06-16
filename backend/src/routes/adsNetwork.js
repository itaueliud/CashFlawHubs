const express = require('express');
const router = express.Router();
const { protect, requireActivation, requireTestUserActionAccess } = require('../middleware/auth');
const {
  getAdsNetworkProviders,
  launchAdsProvider,
  getAdsNetworkHistory,
  getAdsWatchStatus,
  startAdsWatchSession,
  recordAdsWatchHeartbeat,
  endAdsWatchSession,
} = require('../controllers/adsNetworkController');

router.get('/providers', protect, requireActivation, getAdsNetworkProviders);
router.get('/watch', protect, requireActivation, getAdsWatchStatus);
router.post('/watch/start', protect, requireActivation, startAdsWatchSession);
router.post('/watch/heartbeat', protect, requireActivation, recordAdsWatchHeartbeat);
router.post('/watch/end', protect, requireActivation, endAdsWatchSession);
router.get('/launch/:providerKey', protect, requireActivation, requireTestUserActionAccess('Ads / Ad Network'), launchAdsProvider);
router.get('/history', protect, requireActivation, getAdsNetworkHistory);

module.exports = router;
