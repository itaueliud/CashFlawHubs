const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const LedgerTxLog = require('../models/LedgerTxLog');
const { createNotification } = require('../services/notificationCenter');

const ACTIVATION_FEE_USD = Number(process.env.ACTIVATION_FEE_USD || 1.5);

router.post('/:userId/activate', protect, async (req, res) => {
  try {
    if (req.user.role !== 'ledger' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Ledger access required' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.activationStatus === true) {
      return res.status(400).json({ success: false, message: 'User already active' });
    }

    const wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });

    if (wallet.balanceUSD < ACTIVATION_FEE_USD) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance for activation fee' });
    }

    wallet.balanceUSD -= ACTIVATION_FEE_USD;
    wallet.totalWithdrawn += ACTIVATION_FEE_USD;
    if (wallet.balanceUSD < 0) wallet.balanceUSD = 0;
    await wallet.save();

    user.activationStatus = true;
    user.isActive = true;
    user.isBanned = false;
    user.activatedAt = new Date();
    user.lastActivationBy = req.user._id;
    await user.save();

    const tx = await Transaction.create({
      userId: user._id,
      type: 'activation_fee',
      amountLocal: ACTIVATION_FEE_USD,
      amountUSD: ACTIVATION_FEE_USD,
      currency: 'USD',
      country: user.country || 'KE',
      provider: 'internal',
      status: 'successful',
      direction: 'debit',
      metadata: { action: 'ledger_activation', activatedBy: req.user._id },
      processedAt: new Date(),
    });

    await LedgerTxLog.create({
      userId: user._id,
      username: user.name,
      transactionType: 'activation_fee',
      amount: ACTIVATION_FEE_USD,
      currency: 'USD',
      status: 'success',
      processedBy: req.user._id,
      processedAt: new Date(),
      sourceModule: 'ledger_activation',
      notes: 'User activated by ledger',
      ipAddress: req.ip || null,
      beforeBalance: wallet.balanceUSD + ACTIVATION_FEE_USD,
      afterBalance: wallet.balanceUSD,
      relatedTransactionId: tx._id,
    });

    await createNotification({
      userId: user._id,
      type: 'activation_success',
      title: 'Account Activated',
      message: 'Your account has been activated and your wallet has been debited for the activation fee.',
      metadata: { amount: ACTIVATION_FEE_USD },
    });

    res.json({ success: true, message: 'User activated successfully', userId: user._id, activationFee: ACTIVATION_FEE_USD });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/pending', protect, async (req, res) => {
  try {
    if (req.user.role !== 'ledger' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Ledger access required' });
    }

    const pendingUsers = await User.find({ activationStatus: { $ne: true } })
      .select('name email phone userId country activationStatus isActive isBanned referredBy createdAt')
      .sort({ createdAt: -1 });

    res.json({ success: true, pendingUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
