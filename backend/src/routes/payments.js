const express = require('express');
const router = express.Router();
const {
  initiateActivation,
  initiateWalletDeposit,
  initiateTokenPurchase,
  paystackWebhook,
  mpesaCallback,
  jengaCallback,
  mtnMomoCallback,
  telebirrCallback,
  tanzaniaWalletCallback,
  verifyPayment,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const safaricomIpWhitelist = require('../middleware/safaricomIpWhitelist');
const bodyParser = require('body-parser');

router.post('/initiate-activation', protect, initiateActivation);
router.post('/deposits/initiate', protect, initiateWalletDeposit);
router.post('/tokens/purchase', protect, initiateTokenPurchase);
router.get('/verify/:reference', protect, verifyPayment);
// Paystack signs the raw request body. Use raw parser to preserve exact payload for signature verification.
router.post('/paystack/webhook', bodyParser.raw({ type: 'application/json' }), paystackWebhook);
router.post('/mpesa/callback', safaricomIpWhitelist, mpesaCallback);
router.post('/jenga/callback', jengaCallback);
router.post('/mtn-momo/callback', mtnMomoCallback);
router.post('/telebirr/callback', telebirrCallback);
router.post('/tanzania-wallet/callback', tanzaniaWalletCallback);

module.exports = router;
