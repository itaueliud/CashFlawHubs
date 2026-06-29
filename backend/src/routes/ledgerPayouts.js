const express = require('express');
const router = express.Router();
const { protect, ledgerOnly, ledgerOrSuperadminOnly } = require('../middleware/auth');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const LedgerTxLog = require('../models/LedgerTxLog');
const { createNotification } = require('../services/notificationCenter');

const ACTIVATION_FEE_USD = Number(process.env.ACTIVATION_FEE_USD || 1.5);
const getFridayWeekWindow = (weekOffset = 0) => {
  const nowUTC = new Date();
  const day = nowUTC.getUTCDay();
  const daysBack = day >= 5 ? day - 5 : day + 2;
  const weekStartUTC = new Date(Date.UTC(
    nowUTC.getUTCFullYear(),
    nowUTC.getUTCMonth(),
    nowUTC.getUTCDate() - daysBack - (Math.max(0, Number(weekOffset) || 0) * 7),
    0, 0, 0, 0
  ));
  const weekEndUTC = new Date(weekStartUTC.getTime() + (7 * 24 * 60 * 60 * 1000));
  return { weekStartUTC, weekEndUTC };
};
router.get('/users', protect, async (req, res) => {
  try {
    if (req.user.role !== 'ledger' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Ledger access required' });
    }

    const { status = 'all', page = 1, limit = 100 } = req.query;
    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const userQuery = { role: 'user' };
    if (status === 'active') { userQuery.isActive = true; userQuery.isBanned = false; }
    if (status === 'inactive') { userQuery.$or = [{ isActive: false }, { isBanned: true }]; }

    const users = await User.find(userQuery)
      .select('name email phone userId country activationStatus isActive isBanned referredBy createdAt fraudRiskScore fraudRiskLevel fraudReviewStatus fraudRiskReasons')
      .sort({ createdAt: -1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit);

    const total = await User.countDocuments(userQuery);
    const userIds = users.map((u) => u._id);
    const wallets = await Wallet.find({ userId: { $in: userIds } });
    const walletMap = {};
    wallets.forEach((w) => { walletMap[String(w.userId)] = w; });

    let result = users.map((u) => {
      const w = walletMap[String(u._id)] || {};
      const earningMethods = [];
      if (w.surveyEarnings > 0) earningMethods.push('Surveys');
      if (w.taskEarnings > 0) earningMethods.push('Microtasks');
      if (w.offerEarnings > 0) earningMethods.push('Offerwalls');
      if (w.referralEarnings > 0) earningMethods.push('Referrals');
      if (w.freelanceEarnings > 0) earningMethods.push('Remote Jobs');
      if (w.challengeEarnings > 0) earningMethods.push('Challenges');

      return {
        userId: String(u._id),
        name: u.name,
        email: u.email,
        phone: u.phone,
        userRef: u.userId,
        country: u.country,
        accountStatus: u.isBanned ? 'banned' : u.isActive ? 'active' : 'inactive',
        activationStatus: u.activationStatus,
        availableBalance: Number(w.balanceUSD || 0).toFixed(4),
        pendingBalance: Number(w.pendingBalance || 0).toFixed(4),
        carryOver: Number(w.carryOver || 0).toFixed(4),
        totalEarned: Number(w.totalEarned || 0).toFixed(4),
        totalWithdrawn: Number(w.totalWithdrawn || 0).toFixed(4),
        earningMethods,
        lastPaidAt: w.lastPaidAt || null,
      };
    });

    if (status === 'pending') {
      result = result
        .filter((user) => Number(user.pendingBalance || 0) > 0)
        .sort((a, b) => Number(b.pendingBalance || 0) - Number(a.pendingBalance || 0));
    }

    res.json({ success: true, users: result, pagination: { total: status === 'pending' ? result.length : total, page: safePage, limit: safeLimit } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/users/:userId/pay', protect, async (req, res) => {
  try {
    if (req.user.role !== 'ledger' && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Ledger access required' });
    }

    const { override = false } = req.body;
    const nowEAT = new Date(Date.now() + 3 * 3600000);
    const dayEAT = nowEAT.getUTCDay();
    if (dayEAT !== 5 && !override) {
      return res.status(400).json({ success: false, message: 'Payouts are only processed on Fridays. Pass override:true to force.' });
    }

    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (!user.isActive || user.isBanned) {
      return res.status(400).json({ success: false, message: 'Account is not active. Payment blocked.', accountStatus: user.isBanned ? 'banned' : 'inactive' });
    }

    const wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });

    const pendingAmount = Number(wallet.pendingBalance || 0);
    if (pendingAmount <= 0) return res.status(400).json({ success: false, message: 'No pending balance to pay.' });

    // For a payout, the pending balance is cleared because funds leave the system.
    // Do NOT move pending -> available balance; treat pending as already earmarked for withdrawal.
    const beforeBalance = Number(wallet.balanceUSD || 0);
    wallet.pendingBalance = 0;
    wallet.lastPaidAt = new Date();
    wallet.totalWithdrawn = Number(wallet.totalWithdrawn || 0) + pendingAmount;
    await wallet.save();

    const tx = await Transaction.create({
      userId: user._id,
      type: 'manual_payment',
      amountLocal: pendingAmount,
      amountUSD: pendingAmount,
      currency: 'USD',
      country: user.country || 'KE',
      provider: 'internal',
      status: 'successful',
      // direction debit: funds were paid out
      direction: 'debit',
      metadata: { action: 'ledger_payout', paidBy: req.user._id },
      processedAt: new Date(),
    });

    await LedgerTxLog.create({
      userId: user._id,
      username: user.name,
      transactionType: 'payout',
      amount: pendingAmount,
      currency: 'USD',
      status: 'success',
      processedBy: req.user._id,
      processedAt: new Date(),
      sourceModule: 'ledger_payout',
      notes: 'Friday payout processed by ledger',
      ipAddress: req.ip || null,
      beforeBalance,
      afterBalance: Number(wallet.balanceUSD || 0),
      relatedTransactionId: tx._id,
    });

    await createNotification({
      userId: user._id,
      type: 'withdrawal_success',
      title: 'Payout processed',
      message: `Your payout of $${pendingAmount.toFixed(2)} has been processed.`,
      metadata: { amount: pendingAmount },
    });

    res.json({ success: true, amountPaid: pendingAmount, userId: user._id, processedAt: wallet.lastPaidAt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/users/:userId/mark-paid-outside', protect, ledgerOnly, async (req, res) => {
  try {
    const { reason = 'Manual payout recorded outside the system' } = req.body || {};
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });

    const pendingAmount = Number(wallet.pendingBalance || 0);
    if (pendingAmount <= 0) {
      return res.status(400).json({ success: false, message: 'No pending balance to mark as paid.' });
    }

    const beforeBalance = Number(wallet.balanceUSD || 0);
    wallet.pendingBalance = 0;
    wallet.lastPaidAt = new Date();
    wallet.totalWithdrawn = Number(wallet.totalWithdrawn || 0) + pendingAmount;
    await wallet.save();

    const tx = await Transaction.create({
      userId: user._id,
      type: 'manual_payment',
      amountLocal: pendingAmount,
      amountUSD: pendingAmount,
      currency: 'USD',
      country: user.country || 'KE',
      provider: 'internal',
      status: 'successful',
      direction: 'debit',
      metadata: { action: 'manual_outside_system', reason, markedBy: req.user._id },
      processedAt: new Date(),
    });

    await LedgerTxLog.create({
      userId: user._id,
      username: user.name,
      transactionType: 'payout',
      amount: pendingAmount,
      currency: 'USD',
      status: 'success',
      processedBy: req.user._id,
      processedAt: new Date(),
      sourceModule: 'manual_outside_system',
      notes: `Marked paid outside system: ${reason}`,
      ipAddress: req.ip || null,
      beforeBalance,
      afterBalance: Number(wallet.balanceUSD || 0),
      relatedTransactionId: tx._id,
    });

    res.json({ success: true, amountPaid: pendingAmount, userId: user._id, processedAt: wallet.lastPaidAt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/carryover', protect, ledgerOnly, async (req, res) => {
  try {
    const wallets = await Wallet.find({ carryOver: { $gt: 0 } }).populate('userId', 'name email phone userId country isActive isBanned');
    const result = wallets.map((w) => ({ user: w.userId, carryOver: Number(w.carryOver).toFixed(4) }));
    res.json({ success: true, carryOvers: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/weekly-summary', protect, ledgerOnly, async (req, res) => {
  try {
    const weekOffset = Math.max(0, Number(req.query.weekOffset) || 0);
    const { weekStartUTC, weekEndUTC } = getFridayWeekWindow(weekOffset);
    const dateFilter = { processedAt: { $gte: weekStartUTC, $lt: weekEndUTC } };
    const weekEndLabel = new Date(weekEndUTC.getTime() - 1);

    const typeSummary = await LedgerTxLog.aggregate([
      { $match: { ...dateFilter, status: 'success' } },
      {
        $group: {
          _id: '$transactionType',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          userIds: { $addToSet: '$userId' },
        },
      },
    ]);

    const countryBreakdown = await LedgerTxLog.aggregate([
      { $match: { ...dateFilter, status: 'success', transactionType: 'payout' } },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userDoc',
        },
      },
      { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ['$userDoc.country', 'Unknown'] },
          totalPaid: { $sum: '$amount' },
          userCount: { $addToSet: '$userId' },
          txCount: { $sum: 1 },
        },
      },
      {
        $project: {
          country: '$_id',
          totalPaid: 1,
          userCount: { $size: '$userCount' },
          txCount: 1,
        },
      },
      { $sort: { totalPaid: -1 } },
    ]);

    const findEntry = (type) => typeSummary.find((t) => t._id === type) || { totalAmount: 0, count: 0, userIds: [] };
    const payouts = findEntry('payout');
    const activations = findEntry('activation_fee');
    const referrals = findEntry('referral_credit');
    const adjustments = findEntry('manual_adjustment');
    const carryOvers = findEntry('carry_over');

    res.json({
      success: true,
      weekLabel: `${weekStartUTC.toISOString().slice(0, 10)} - ${weekEndLabel.toISOString().slice(0, 10)}`,
      weekOffset,
      summary: {
        totalPayoutUSD: Number((payouts.totalAmount || 0).toFixed(4)),
        usersPayoutCount: payouts.userIds.length,
        totalActivationFeesUSD: Number((activations.totalAmount || 0).toFixed(4)),
        activationsCount: activations.count,
        totalReferralCommUSD: Number((referrals.totalAmount || 0).toFixed(4)),
        referralCommCount: referrals.count,
        totalManualAdjUSD: Number((adjustments.totalAmount || 0).toFixed(4)),
        totalCarryOverUSD: Number((carryOvers.totalAmount || 0).toFixed(4)),
      },
      countryBreakdown,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get('/bulk-preview', protect, ledgerOnly, async (req, res) => {
  try {
    const wallets = await Wallet.find({ pendingBalance: { $gt: 0 } }).populate('userId', 'role isActive isBanned');
    const payable = wallets.filter((w) => w.userId && w.userId.role === 'user' && w.userId.isActive && !w.userId.isBanned);
    const totalUSD = payable.reduce((sum, w) => sum + Number(w.pendingBalance || 0), 0);
    res.json({ success: true, userCount: payable.length, totalUSD: Number(totalUSD.toFixed(4)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/bulk-pay', protect, ledgerOnly, async (req, res) => {
  try {
    const { override = false } = req.body;
    const nowEAT = new Date(Date.now() + 3 * 3600000);
    if (nowEAT.getUTCDay() !== 5 && !override) {
      return res.status(400).json({ success: false, message: 'Bulk payouts only run on Fridays. Pass override:true to force.' });
    }

    const eligibleWallets = await Wallet.find({ pendingBalance: { $gt: 0 } }).populate('userId', 'name email phone country isActive isBanned role');
    const payable = eligibleWallets.filter((w) => w.userId && w.userId.role === 'user' && w.userId.isActive && !w.userId.isBanned);

    if (!payable.length) {
      return res.json({ success: true, message: 'No eligible users to pay.', processed: 0, totalUSD: 0 });
    }

    let processed = 0;
    let totalUSD = 0;
    const errors = [];

    for (const wallet of payable) {
      try {
        const user = wallet.userId;
        const pendingAmount = Number(wallet.pendingBalance || 0);
        if (pendingAmount <= 0) continue;

        const beforeBalance = Number(wallet.balanceUSD || 0);
        wallet.balanceUSD += pendingAmount;
        wallet.totalEarned += pendingAmount;
        wallet.pendingBalance = 0;
        wallet.lastPaidAt = new Date();
        await wallet.save();

        const tx = await Transaction.create({
          userId: user._id,
          type: 'manual_payment',
          amountLocal: pendingAmount,
          amountUSD: pendingAmount,
          currency: 'USD',
          country: user.country || 'Unknown',
          provider: 'internal',
          status: 'successful',
          direction: 'credit',
          payoutStatus: 'executed',
          payoutExecutedAt: new Date(),
          payoutExecutedBy: req.user._id,
          metadata: { source: 'ledger_bulk_payout' },
        });

        await LedgerTxLog.create({
          userId: user._id,
          username: user.name,
          transactionType: 'payout',
          amount: pendingAmount,
          currency: 'USD',
          status: 'success',
          processedBy: req.user._id,
          processedAt: new Date(),
          sourceModule: 'bulk_payout',
          notes: 'Friday bulk payout',
          ipAddress: req.ip || null,
          beforeBalance,
          afterBalance: wallet.balanceUSD,
          relatedTransactionId: tx._id,
        });

        await createNotification({
          userId: user._id,
          type: 'withdrawal_success',
          title: 'Payout processed',
          message: `Your payout of $${pendingAmount.toFixed(2)} has been processed.`,
          metadata: { amount: pendingAmount },
        });

        processed += 1;
        totalUSD += pendingAmount;
      } catch (err) {
        errors.push(err.message || 'Error processing payout');
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.to('ledger-room').emit('bulk_payout:complete', {
        processed,
        totalUSD: Number(totalUSD.toFixed(4)),
        processedAt: new Date().toISOString(),
      });
    }

    res.json({ success: true, message: `Bulk payout complete. ${processed} users paid.`, processed, totalUSD: Number(totalUSD.toFixed(4)), errors: errors.length ? errors : undefined });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/carryover/:userId/apply', protect, ledgerOnly, async (req, res) => {
  try {
    const wallet = await Wallet.findOne({ userId: req.params.userId });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });

    const carryOver = Number(wallet.carryOver || 0);
    if (carryOver <= 0) return res.status(400).json({ success: false, message: 'No carry-over available to apply.' });

    wallet.pendingBalance += carryOver;
    wallet.carryOver = 0;
    await wallet.save();

    await LedgerTxLog.create({
      userId: wallet.userId,
      transactionType: 'carry_over',
      amount: carryOver,
      currency: 'USD',
      status: 'success',
      processedBy: req.user._id,
      processedAt: new Date(),
      sourceModule: 'carryover_apply',
      notes: reason ? `Applied carry-over to pending balance: ${reason}` : 'Applied carry-over to pending balance',
      ipAddress: req.ip || null,
      beforeBalance: null,
      afterBalance: Number(wallet.pendingBalance.toFixed(4)),
    });

    res.json({ success: true, message: `Applied $${carryOver.toFixed(4)} carry-over to pending balance.`, amount: carryOver });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/carryover/:userId/write-off', protect, ledgerOnly, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'reason is required' });

    const wallet = await Wallet.findOne({ userId: req.params.userId });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });

    const amount = Number(wallet.carryOver || 0);
    wallet.carryOver = 0;
    await wallet.save();

    await LedgerTxLog.create({
      userId: wallet.userId,
      transactionType: 'manual_adjustment',
      amount,
      currency: 'USD',
      status: 'success',
      processedBy: req.user._id,
      processedAt: new Date(),
      sourceModule: 'carryover_writeoff',
      notes: `Write-off: ${reason}`,
      ipAddress: req.ip || null,
      beforeBalance: null,
      afterBalance: null,
    });

    res.json({ success: true, message: `$${amount.toFixed(4)} carry-over written off`, amount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/adjust-balance/:userId', protect, ledgerOnly, async (req, res) => {
  try {
    const { field, direction, amount, reason } = req.body;
    const validFields = ['pendingBalance', 'balanceUSD'];
    if (!validFields.includes(field)) {
      return res.status(400).json({ success: false, message: 'field must be pendingBalance or balanceUSD' });
    }
    if (!['credit', 'debit'].includes(direction)) {
      return res.status(400).json({ success: false, message: 'direction must be credit or debit' });
    }
    const amountNumber = Number(amount);
    if (!amountNumber || amountNumber <= 0) {
      return res.status(400).json({ success: false, message: 'amount must be a positive number' });
    }
    if (!reason || String(reason).trim().length < 5) {
      return res.status(400).json({ success: false, message: 'reason is required' });
    }

    const wallet = await Wallet.findOne({ userId: req.params.userId });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });

    const beforeValue = Number(wallet[field] || 0);
    const newValue = direction === 'credit' ? beforeValue + amountNumber : beforeValue - amountNumber;
    if (newValue < 0) {
      return res.status(400).json({ success: false, message: 'Adjustment would make balance negative' });
    }

    wallet[field] = newValue;
    await wallet.save();

    await LedgerTxLog.create({
      userId: wallet.userId,
      transactionType: 'manual_adjustment',
      amount: amountNumber,
      currency: 'USD',
      status: 'success',
      processedBy: req.user._id,
      processedAt: new Date(),
      sourceModule: 'balance_adjustment',
      notes: `${direction === 'credit' ? 'Credit' : 'Debit'} ${field}: ${reason}`,
      ipAddress: req.ip || null,
      beforeBalance: beforeValue,
      afterBalance: newValue,
    });

    res.json({ success: true, message: 'Wallet adjustment completed.', field, direction, amount: amountNumber, before: beforeValue, after: newValue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

router.post('/carryover/bulk-apply', protect, ledgerOnly, async (req, res) => {
  try {
    const wallets = await Wallet.find({ carryOver: { $gt: 0 } }).populate('userId', 'name email phone country userId isActive isBanned role');
    const eligible = wallets.filter((wallet) => wallet.userId && wallet.userId.role === 'user' && wallet.userId.isActive && !wallet.userId.isBanned);

    let processed = 0;
    let totalApplied = 0;

    for (const wallet of eligible) {
      const carryOver = Number(wallet.carryOver || 0);
      if (carryOver <= 0) continue;

      const beforePending = Number(wallet.pendingBalance || 0);
      wallet.pendingBalance = beforePending + carryOver;
      wallet.carryOver = 0;
      await wallet.save();

      await LedgerTxLog.create({
        userId: wallet.userId._id,
        username: wallet.userId.name || wallet.userId.email || 'Unknown',
        transactionType: 'carry_over',
        amount: carryOver,
        currency: 'USD',
        status: 'success',
        processedBy: req.user._id,
        processedAt: new Date(),
        sourceModule: 'carryover_bulk_apply',
        notes: 'Bulk carry-over applied to pending balance',
        ipAddress: req.ip || null,
        beforeBalance: beforePending,
        afterBalance: Number(wallet.pendingBalance.toFixed(4)),
      });

      processed += 1;
      totalApplied += carryOver;
    }

    res.json({
      success: true,
      message: `Bulk carry-over applied to ${processed} users`,
      processed,
      totalApplied: Number(totalApplied.toFixed(4)),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/weekly-withdrawals', protect, ledgerOnly, async (req, res) => {
  try {
    const { weekStartUTC, weekEndUTC } = getFridayWeekWindow(0);
    const weekEndLabel = new Date(weekEndUTC.getTime() - 1);

    const withdrawals = await Transaction.find({
      type: 'manual_payment',
      status: 'successful',
      processedAt: { $gte: weekStartUTC, $lt: weekEndUTC },
    })
      .populate('userId', 'name email phone country userId')
      .sort({ processedAt: -1 })
      .limit(500);

    const list = withdrawals.map((tx) => ({
      userId: String(tx.userId?._id || tx.userId || ''),
      name: tx.userId?.name || 'Unknown',
      phone: tx.userId?.phone || '',
      country: tx.userId?.country || 'Unknown',
      amountUSD: Number(tx.amountUSD || 0),
      processedAt: tx.processedAt || tx.createdAt,
      earningMethods: tx.metadata?.earningMethods || [],
    }));

    res.json({
      success: true,
      weekLabel: `${weekStartUTC.toISOString().slice(0, 10)} - ${weekEndLabel.toISOString().slice(0, 10)}`,
      count: list.length,
      totalUSD: Number(list.reduce((sum, item) => sum + Number(item.amountUSD || 0), 0).toFixed(4)),
      withdrawals: list,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});
router.get('/reconciliation/snapshot', protect, ledgerOnly, async (req, res) => {
  try {
    const [pendingAgg, carryAgg, activeUsers, weeklyPaid] = await Promise.all([
      Wallet.aggregate([
        { $match: { pendingBalance: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$pendingBalance' }, count: { $sum: 1 } } },
      ]),
      Wallet.aggregate([
        { $match: { carryOver: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$carryOver' }, count: { $sum: 1 } } },
      ]),
      User.countDocuments({ role: 'user', activationStatus: true, isActive: true, isBanned: false }),
      Transaction.aggregate([
        { $match: { type: 'manual_payment', status: 'successful', processedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        { $group: { _id: null, total: { $sum: '$amountUSD' }, count: { $sum: 1 } } },
      ]),
    ]);

    const pendingTotal = Number(pendingAgg[0]?.total || 0);
    const carryOverTotal = Number(carryAgg[0]?.total || 0);
    const paidThisCycle = Number(weeklyPaid[0]?.total || 0);
    const activeUserCount = Number(activeUsers || 0);

    res.json({
      success: true,
      pendingTotal,
      carryOverTotal,
      activeUserCount,
      paidThisCycle,
      variance: Number((pendingTotal - paidThisCycle).toFixed(4)),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});








