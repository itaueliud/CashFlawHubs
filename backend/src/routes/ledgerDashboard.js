const express = require('express');
const router = express.Router();
const { protect, ledgerOrSuperadminOnly } = require('../middleware/auth');
const Transaction = require('../models/Transaction');

const getLedgerBaseQuery = (range = '30d') => {
  const now = new Date();
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const from = new Date(now);
  from.setDate(from.getDate() - days);

  return {
    createdAt: { $gte: from, $lte: now },
    status: 'successful',
    type: { $in: ['activation', 'job_posting', 'token_purchase'] },
  };
};

router.get('/', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const range = String(req.query.range || '30d');
    const ledgerQuery = getLedgerBaseQuery(range);

    const [summary] = await Transaction.aggregate([
      { $match: ledgerQuery },
      {
        $group: {
          _id: null,
          totalUSD: { $sum: '$amountUSD' },
          totalLocal: { $sum: '$amountLocal' },
          count: { $sum: 1 },
        },
      },
    ]);

    const transactions = await Transaction.find(ledgerQuery)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('userId', 'name email phone role country userId');

    const payoutQueueQuery = {
      createdAt: ledgerQuery.createdAt,
      status: 'pending',
      type: { $in: ['withdrawal', 'referral_reward'] },
    };

    const payoutQueue = await Transaction.find(payoutQueueQuery)
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('userId', 'name email phone role country userId');

    const payoutQueueTotalUSD = payoutQueue.reduce((sum, tx) => sum + Number(tx.amountUSD || 0), 0);

    res.json({
      success: true,
      ledger: {
        range,
        totalUSD: summary?.totalUSD || 0,
        totalLocal: summary?.totalLocal || 0,
        count: summary?.count || 0,
        transactions,
        payoutQueue,
        payoutQueueTotalUSD,
        payoutQueueCount: payoutQueue.length,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

