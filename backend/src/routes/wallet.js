const express = require('express');
const router = express.Router();
const { getWallet, getTransactions, getTokenPackages, purchaseTokens, redeemXp } = require('../controllers/walletController');
const { protect } = require('../middleware/auth');

router.get('/', protect, getWallet);
router.get('/transactions', protect, getTransactions);
router.get('/token-packages', protect, getTokenPackages);
router.post('/tokens/purchase', protect, purchaseTokens);
router.post('/xp/redeem', protect, redeemXp);

module.exports = router;
