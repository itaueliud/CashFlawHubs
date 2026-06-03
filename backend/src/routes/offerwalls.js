const express = require('express');
const router = express.Router();
const { getAyetStudiosWall, getAdGateWall, ayetStudiosCallback, adGateCallback, launchOfferwall, getOfferwallHistory } = require('../controllers/offerwallController');
const { protect, requireActivation, requireTestUserActionAccess } = require('../middleware/auth');

router.get('/ayetstudios', protect, requireActivation, getAyetStudiosWall);
router.get('/adgate', protect, requireActivation, getAdGateWall);
router.get('/launch/:providerKey', protect, requireActivation, requireTestUserActionAccess('Offerwalls'), launchOfferwall);
router.get('/history', protect, requireActivation, getOfferwallHistory);
router.get('/ayetstudios/callback', ayetStudiosCallback);
router.get('/adgate/callback', adGateCallback);

module.exports = router;
