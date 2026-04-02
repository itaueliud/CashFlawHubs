const express = require('express');
const router = express.Router();
const { getAyetStudiosWall, getAdGateWall, ayetStudiosCallback, adGateCallback } = require('../controllers/offerwallController');
const { protect, requireActivation } = require('../middleware/auth');

router.get('/ayetstudios', protect, requireActivation, getAyetStudiosWall);
router.get('/adgate', protect, requireActivation, getAdGateWall);
router.get('/ayetstudios/callback', ayetStudiosCallback);
router.get('/adgate/callback', adGateCallback);

module.exports = router;
