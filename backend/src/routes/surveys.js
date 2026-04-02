const express = require('express');
const router = express.Router();
const { getCPXSurveyWall, getBitLabsWall, cpxCallback, bitlabsCallback, getSurveyHistory } = require('../controllers/surveyController');
const { protect, requireActivation } = require('../middleware/auth');

router.get('/cpx', protect, requireActivation, getCPXSurveyWall);
router.get('/bitlabs', protect, requireActivation, getBitLabsWall);
router.get('/cpx/callback', cpxCallback);
router.post('/bitlabs/callback', bitlabsCallback);
router.get('/history', protect, getSurveyHistory);

module.exports = router;
