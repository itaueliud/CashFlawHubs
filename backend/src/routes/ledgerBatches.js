const express = require('express');
const router = express.Router();
const { protect, ledgerOrSuperadminOnly } = require('../middleware/auth');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const LedgerTxLog = require('../models/LedgerTxLog');
const PayoutBatch = require('../models/PayoutBatch');
const { createNotification } = require('../services/notificationCenter');

const buildBatchRef = () => `BATCH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

const processManualPayout = async ({ req, user, amountUSD, amountLocal, currency, country, providerReference, paymentMethod, note }) => {
  const amount = Number(amountUSD);
  const wallet = await Wallet.findOneAndUpdate(
    { userId: user._id },
    {
      $inc: {
        balanceUSD: amount,
        totalDeposited: amount,
        totalEarned: amount,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  const transaction = await Transaction.create({
    userId: user._id,
    type: 'manual_payment',
    status: 'successful',
    direction: 'credit',
    provider: 'manual',
    amountUSD: amount,
    amountLocal: Number(amountLocal) || amount,
    currency: currency || 'USD',
    country: country || user.country,
    providerTransactionId: providerReference,
    payoutStatus: 'executed',
    payoutExecutedAt: new Date(),
    payoutExecutedBy: req.user._id,
    processedAt: new Date(),
    metadata: {
      paymentMethod,
      note: note || '',
      recordedBy: req.user.userId || req.user.email,
      recordedByRole: req.user.role,
      walletSnapshot: {
        balanceBefore: Number(wallet.balanceUSD || 0) - amount,
        balanceAfter: Number(wallet.balanceUSD || 0),
      },
    },
  });

  await LedgerTxLog.create({
    userId: user._id,
    username: user.name,
    transactionType: 'manual_payment',
    amount,
    currency: currency || 'USD',
    status: 'success',
    processedBy: req.user._id,
    processedAt: new Date(),
    sourceModule: 'ledger_manual_payout',
    notes: note || 'Manual payout recorded by ledger',
    ipAddress: req.ip || null,
    beforeBalance: Number(wallet.balanceUSD || 0) - amount,
    afterBalance: Number(wallet.balanceUSD || 0),
    relatedTransactionId: transaction._id,
  });

  await createNotification({
    userId: user._id,
    type: 'manual_payment',
    title: 'Manual payout recorded',
    message: `A manual payout of $${amount.toFixed(2)} has been recorded on your account.`,
    metadata: { amount, providerReference },
  });

  return { transaction, wallet };
};

router.get('/', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const batches = await PayoutBatch.find({}).populate('executedBy', 'name email role userId').sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, batches });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const batch = await PayoutBatch.findById(req.params.id).populate('executedBy', 'name email role userId').populate('items.userId', 'name email phone userId country');
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }
    res.json({ success: true, batch });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/manual-payout', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const {
      userIdentifier,
      amountUSD,
      amountLocal,
      currency,
      country,
      providerReference,
      paymentMethod,
      note,
    } = req.body || {};

    if (!userIdentifier || amountUSD == null || !providerReference || !paymentMethod) {
      return res.status(400).json({
        success: false,
        message: 'userIdentifier, amountUSD, providerReference and paymentMethod are required',
      });
    }

    const amount = Number(amountUSD);
    if (Number.isNaN(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'amountUSD must be a positive number' });
    }

    const normalizedIdentifier = String(userIdentifier).trim();
    const user = await User.findOne({
      $or: [
        { email: normalizedIdentifier.toLowerCase() },
        { userId: normalizedIdentifier },
      ],
    });

    if (!user) {
      return res.status(404).json({ success: false, message: `No user found for: ${normalizedIdentifier}` });
    }

    const reference = String(providerReference).trim();
    const duplicate = await Transaction.findOne({ providerTransactionId: reference });
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: `Reference ${reference} already exists in the system`,
      });
    }

    const batchRef = buildBatchRef();
    const { transaction } = await processManualPayout({
      req,
      user,
      amountUSD: amount,
      amountLocal,
      currency,
      country,
      providerReference: reference,
      paymentMethod,
      note,
    });

    const batch = await PayoutBatch.create({
      batchRef,
      source: 'manual',
      status: 'complete',
      items: [{
        userId: user._id,
        userCode: user.userId,
        reference,
        amountUSD: amount,
        currency: currency || 'USD',
        paymentMethod,
        provider: 'manual',
        status: 'successful',
        note: note || '',
      }],
      summary: {
        totalUSD: amount,
        count: 1,
        successful: 1,
        failed: 0,
      },
      executedBy: req.user._id,
      notes: note || '',
    });

    return res.json({
      success: true,
      message: `Manual payment of $${amount.toFixed(2)} recorded for ${user.email || user.userId}`,
      batch,
      transaction: {
        id: transaction._id,
        reference,
        amount,
        user: {
          id: user.userId,
          email: user.email,
          name: user.name,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
