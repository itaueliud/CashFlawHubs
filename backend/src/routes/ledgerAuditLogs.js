const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const LedgerTxLog = require('../models/LedgerTxLog');
const Transaction = require('../models/Transaction');

const TRANSACTION_TYPES = new Set([
  'activation',
  'withdrawal',
  'referral_reward',
  'survey',
  'task',
  'offer',
  'challenge',
  'freelance',
  'token_purchase',
  'token_spend',
  'job_posting',
  'deposit',
  'xp_redemption',
  'manual_payment',
  'creator_hub_upload',
  'creator_hub_purchase',
  'creator_hub_earning',
]);

const LEDGER_TYPES = new Set(['payout', 'activation_fee', 'referral_credit', 'manual_adjustment', 'carry_over']);

const asDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const buildDateFilter = (dateFrom, dateTo) => {
  if (!dateFrom && !dateTo) return null;
  const filter = {};
  const from = asDate(dateFrom);
  const to = asDate(dateTo);
  if (from) filter.$gte = from;
  if (to) filter.$lte = to;
  return Object.keys(filter).length ? filter : null;
};

const normalizeProcessedById = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

const mapTransactionLog = (tx) => ({
  _id: `tx:${tx._id}`,
  source: 'transaction',
  sourceLabel: 'Transaction',
  transactionType: tx.type,
  amount: Number(tx.amountUSD ?? tx.amountLocal ?? 0),
  currency: tx.currency || 'USD',
  status: tx.status || 'unknown',
  userId: tx.userId,
  username: tx.userId?.name || tx.userId?.email || tx.userId?.phone || 'Unknown user',
  processedBy: tx.payoutExecutedBy || null,
  processedByName: tx.payoutExecutedBy?.name || tx.payoutExecutedBy?.email || null,
  processedAt: tx.processedAt || tx.createdAt,
  notes: tx.failureReason || tx.metadata?.reason || tx.metadata?.intent || tx.metadata?.action || null,
  beforeBalance: null,
  afterBalance: null,
  relatedTransactionId: tx._id,
  metadata: tx.metadata || {},
});

const mapLedgerLog = (log) => ({
  _id: `ledger:${log._id}`,
  source: 'ledger_tx_log',
  sourceLabel: 'Ledger log',
  transactionType: log.transactionType,
  amount: Number(log.amount || 0),
  currency: log.currency || 'USD',
  status: log.status || 'unknown',
  userId: log.userId,
  username: log.userId?.name || log.username || log.userId?.email || 'Unknown user',
  processedBy: log.processedBy || null,
  processedByName: log.processedBy?.name || log.processedBy?.email || null,
  processedAt: log.processedAt || log.createdAt,
  notes: log.notes || null,
  beforeBalance: log.beforeBalance ?? null,
  afterBalance: log.afterBalance ?? null,
  relatedTransactionId: log.relatedTransactionId || null,
  metadata: log.metadata || {},
});

const logMatchesFilters = (log, { transactionType, status, processedBy, userId, dateFrom, dateTo }) => {
  if (transactionType && String(log.transactionType || '') !== String(transactionType)) return false;
  if (status && String(log.status || '') !== String(status)) return false;
  if (userId && String(log.userId?._id || log.userId || '') !== String(userId)) return false;
  if (processedBy && normalizeProcessedById(log.processedBy) !== String(processedBy)) return false;

  const date = asDate(log.processedAt || log.createdAt);
  const from = asDate(dateFrom);
  const to = asDate(dateTo);
  if (from && (!date || date < from)) return false;
  if (to && (!date || date > to)) return false;

  return true;
};

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
    } = req.query;

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    const recentLimit = Math.min(Math.max(safePage * safeLimit * 2, safeLimit * 2), 500);
    const dateFilter = buildDateFilter(dateFrom, dateTo);

    const transactionQuery = {};
    if (userId) transactionQuery.userId = userId;
    if (status) transactionQuery.status = status;
    if (dateFilter) transactionQuery.createdAt = dateFilter;
    if (transactionType && TRANSACTION_TYPES.has(String(transactionType))) {
      transactionQuery.type = String(transactionType);
    } else if (!transactionType) {
      transactionQuery.type = { $in: Array.from(TRANSACTION_TYPES) };
    } else if (!LEDGER_TYPES.has(String(transactionType))) {
      transactionQuery.type = { $in: Array.from(TRANSACTION_TYPES) };
    }

    const ledgerQuery = {};
    if (userId) ledgerQuery.userId = userId;
    if (status) ledgerQuery.status = status;
    if (dateFilter) ledgerQuery.processedAt = dateFilter;
    if (transactionType && LEDGER_TYPES.has(String(transactionType))) {
      ledgerQuery.transactionType = String(transactionType);
    } else if (!transactionType) {
      ledgerQuery.transactionType = { $in: Array.from(LEDGER_TYPES) };
    } else if (!TRANSACTION_TYPES.has(String(transactionType))) {
      ledgerQuery.transactionType = { $in: Array.from(LEDGER_TYPES) };
    }

    const [transactionLogs, ledgerLogs] = await Promise.all([
      Transaction.find(transactionQuery)
        .populate('userId', 'name email phone userId country')
        .populate('payoutExecutedBy', 'name email role')
        .sort({ createdAt: -1 })
        .limit(recentLimit),
      LedgerTxLog.find(ledgerQuery)
        .populate('userId', 'name email phone userId country')
        .populate('processedBy', 'name email role')
        .sort({ processedAt: -1 })
        .limit(recentLimit),
    ]);

    const merged = [
      ...transactionLogs.map(mapTransactionLog),
      ...ledgerLogs.map(mapLedgerLog),
    ]
      .filter((log) => logMatchesFilters(log, { transactionType, status, processedBy, userId, dateFrom, dateTo }))
      .sort((a, b) => new Date(b.processedAt || b.createdAt) - new Date(a.processedAt || a.createdAt));

    const total = merged.length;
    const logs = merged.slice((safePage - 1) * safeLimit, safePage * safeLimit);

    res.json({
      success: true,
      logs,
      pagination: { total, page: safePage, limit: safeLimit },
      live: true,
      latestAt: logs[0]?.processedAt || logs[0]?.createdAt || null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:logId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'ledger' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Ledger access required' });
    }

    const [kind, id] = String(req.params.logId || '').split(':');
    if (!kind || !id) {
      return res.status(400).json({ success: false, message: 'Invalid log id' });
    }

    if (kind === 'ledger') {
      const log = await LedgerTxLog.findById(id)
        .populate('userId', 'name email phone userId country')
        .populate('processedBy', 'name email role')
        .populate('relatedTransactionId');

      if (!log) return res.status(404).json({ success: false, message: 'Log not found' });
      return res.json({ success: true, log: mapLedgerLog(log) });
    }

    if (kind === 'tx') {
      const tx = await Transaction.findById(id)
        .populate('userId', 'name email phone userId country')
        .populate('payoutExecutedBy', 'name email role');

      if (!tx) return res.status(404).json({ success: false, message: 'Log not found' });
      return res.json({ success: true, log: mapTransactionLog(tx) });
    }

    return res.status(404).json({ success: false, message: 'Log not found' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
