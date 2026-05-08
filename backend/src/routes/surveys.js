const express = require('express');
const router = express.Router();
const { getCPXSurveyWall, getBitLabsWall, cpxCallback, bitlabsCallback, getSurveyFeed, getSurveyHistory, launchSurvey } = require('../controllers/surveyController');
const { protect, requireActivation } = require('../middleware/auth');

router.get('/feed', protect, requireActivation, getSurveyFeed);
router.get('/launch/:providerKey/:surveyId?', protect, requireActivation, launchSurvey);
router.get('/cpx', protect, requireActivation, getCPXSurveyWall);
router.get('/bitlabs', protect, requireActivation, getBitLabsWall);
router.get('/cpx/callback', cpxCallback);
router.post('/bitlabs/callback', bitlabsCallback);
router.get('/history', protect, getSurveyHistory);

module.exports = router;
