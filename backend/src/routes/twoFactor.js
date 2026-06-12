const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  setup2FA,
  verifySetup2FA,
  disable2FA,
  get2FAStatus,
  verify2FALogin,
} = require('../controllers/twoFactorController');

router.get('/status', protect, get2FAStatus);
router.post('/setup', protect, setup2FA);
router.post('/verify-setup', protect, verifySetup2FA);
router.post('/disable', protect, disable2FA);
router.post('/verify-login', verify2FALogin); // no protect

module.exports = router;
