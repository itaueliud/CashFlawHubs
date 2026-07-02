const express = require('express');
const router = express.Router();
const { protect, ledgerOrSuperadminOnly } = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const { getAllRailStates, setRailState } = require('../services/railStateService');
const { COUNTRIES } = require('../config/countries');

router.get('/', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const states = await getAllRailStates();
    const usage = await Transaction.aggregate([
      { $match: { status: 'successful', provider: { $exists: true, $ne: null, $ne: '' } } },
      { $group: { _id: '$provider', count: { $sum: 1 }, totalUSD: { $sum: '$amountUSD' } } },
      { $sort: { totalUSD: -1 } },
    ]);

    res.json({
      success: true,
      states,
      countries: COUNTRIES,
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

router.post('/toggle', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const { strategyId, isEnabled, reason } = req.body;
    if (!strategyId || typeof isEnabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Invalid payload' });
    }
    const state = await setRailState(strategyId, isEnabled, reason, req.user._id);
    res.json({ success: true, state });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
