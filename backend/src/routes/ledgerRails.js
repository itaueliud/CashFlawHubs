const express = require('express');
const router = express.Router();
const { protect, ledgerOrSuperadminOnly } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const { HYBRID_PAYMENT_STACK, COUNTRY_PAYMENT_PRIORITY, PROVIDER_STATUS } = require('../config/paymentStack');

router.get('/', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const usage = await Transaction.aggregate([
      {
        $match: {
          status: 'successful',
          provider: { $exists: true, $ne: null, $ne: '' },
        },
      },
      {
        $group: {
          _id: '$provider',
          count: { $sum: 1 },
          totalUSD: { $sum: '$amountUSD' },
        },
      },
      {
        $sort: { totalUSD: -1 },
      },
    ]);

    res.json({
      success: true,
      rails: HYBRID_PAYMENT_STACK,
      countryPriority: COUNTRY_PAYMENT_PRIORITY,
      providerStatus: PROVIDER_STATUS,
      usage: usage.map((item) => ({
        provider: item._id,
        count: item.count,
        totalUSD: Number(item.totalUSD || 0),
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
