const express = require('express');
const router = express.Router();
const {
  initiateActivation,
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

router.post('/initiate-activation', protect, initiateActivation);
router.post('/tokens/purchase', protect, initiateTokenPurchase);
router.get('/verify/:reference', protect, verifyPayment);
router.post('/paystack/webhook', paystackWebhook);
router.post('/mpesa/callback', mpesaCallback);
router.post('/jenga/callback', jengaCallback);
router.post('/mtn-momo/callback', mtnMomoCallback);
router.post('/telebirr/callback', telebirrCallback);
router.post('/tanzania-wallet/callback', tanzaniaWalletCallback);

module.exports = router;
