const express = require('express');
const router = express.Router();
const {
  initiateActivation,
  paystackWebhook,
  mpesaCallback,
  verifyPayment,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

router.post('/initiate-activation', protect, initiateActivation);
router.get('/verify/:reference', protect, verifyPayment);
router.post('/paystack/webhook', paystackWebhook);
router.post('/mpesa/callback', mpesaCallback);

module.exports = router;
