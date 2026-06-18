const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const LedgerTxLog = require('../models/LedgerTxLog');

router.get('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'ledger' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Ledger access required' });
    }

    const {
      page = 1,
      limit = 100,
      userId = '',
      transactionType = '',
      status = '',
      processedBy = '',
      dateFrom = '',
      dateTo = '',
      amountMin = '',
      amountMax = '',
    } = req.query;

    const query = {};
    if (userId) query.userId = userId;
    if (transactionType) query.transactionType = transactionType;
    if (status) query.status = status;
    if (processedBy) query.processedBy = processedBy;

    if (dateFrom || dateTo) {
      query.processedAt = {};
      if (dateFrom) query.processedAt.$gte = new Date(dateFrom);
      if (dateTo) query.processedAt.$lte = new Date(dateTo);
    }
    if (amountMin || amountMax) {
      query.amount = {};
      if (amountMin) query.amount.$gte = Number(amountMin);
      if (amountMax) query.amount.$lte = Number(amountMax);
    }

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const [logs, total] = await Promise.all([
      LedgerTxLog.find(query)
        .populate('userId', 'name email phone userId country')
        .populate('processedBy', 'name email role')
        .sort({ processedAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit),
      LedgerTxLog.countDocuments(query),
    ]);

    res.json({ success: true, logs, pagination: { total, page: safePage, limit: safeLimit } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:logId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'ledger' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Ledger access required' });
    }

    const log = await LedgerTxLog.findById(req.params.logId)
      .populate('userId', 'name email phone userId country')
      .populate('processedBy', 'name email role')
      .populate('relatedTransactionId');

    if (!log) return res.status(404).json({ success: false, message: 'Log not found' });
    res.json({ success: true, log });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
