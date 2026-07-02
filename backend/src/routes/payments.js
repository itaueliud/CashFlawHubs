const express = require('express');
const router = express.Router();
const {
  initiateActivation,
  initiateWalletDeposit,
  initiateTokenPurchase,
  paystackWebhook,
  mpesaCallback,
  mtnMomoCallback,
  telebirrCallback,
  tanzaniaWalletCallback,
  pawapayCallback,
  verifyPayment,
  getPayoutMethods,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');
const safaricomIpWhitelist = require('../middleware/safaricomIpWhitelist');
const bodyParser = require('body-parser');

router.post('/initiate-activation', protect, initiateActivation);
router.post('/deposits/initiate', protect, initiateWalletDeposit);
router.post('/tokens/purchase', protect, initiateTokenPurchase);
router.get('/verify/:reference', protect, verifyPayment);
router.get('/methods', protect, getPayoutMethods);
// Paystack signs the raw request body. Use raw parser to preserve exact payload for signature verification.
router.post('/paystack/webhook', bodyParser.raw({ type: 'application/json' }), paystackWebhook);
router.post('/mpesa/callback', safaricomIpWhitelist, mpesaCallback);
router.post('/mtn-momo/callback', mtnMomoCallback);
router.post('/telebirr/callback', telebirrCallback);
router.post('/tanzania-wallet/callback', tanzaniaWalletCallback);
router.post('/pawapay/callback', bodyParser.raw({ type: 'application/json' }), pawapayCallback);

module.exports = router;
