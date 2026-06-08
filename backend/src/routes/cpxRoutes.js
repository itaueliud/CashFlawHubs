const express    = require('express');
const router     = express.Router();
const { handlePostback, getIframeParams, getHistory } = require('../controllers/cpxController');
const { protect } = require('../middleware/auth');

// Public — CPX servers call this, no JWT auth
router.get('/postback',  handlePostback);
router.post('/postback', handlePostback);

// Authenticated — frontend calls these
router.get('/iframe-params', protect, getIframeParams);
router.get('/history',       protect, getHistory);

module.exports = router;
