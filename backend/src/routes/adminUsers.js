const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Notification = require('../models/Notification');
const { logAdminAction } = require('../utils/adminAudit');
const { createNotification } = require('../services/notificationCenter');

router.get('/', protect, requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      search = '',
      country = '',
      status = '',
      kycStatus = '',
      level = '',
      sortBy = 'createdAt',
      sortDir = '-1',
    } = req.query;

    const query = { role: 'user' };
    if (country) query.country = country;
    if (level) query.level = Number(level);
    if (kycStatus) query.identityVerificationStatus = kycStatus;

    if (status === 'active') { query.isActive = true; query.isBanned = false; }
    if (status === 'suspended') { query.isActive = false; query.isBanned = false; }
    if (status === 'banned') { query.isBanned = true; }

    if (search) {
      const r = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: r }, { email: r }, { phone: r }, { userId: r }, { referralCode: r }];
    }

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const sort = { [sortBy]: Number(sortDir) === 1 ? 1 : -1 };

    const [users, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -emailVerificationToken')
        .sort(sort)
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit),
      User.countDocuments(query),
    ]);

    res.json({ success: true, users, pagination: { total, page: safePage, limit: safeLimit } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', protect, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-passwordHash -twoFactorSecret -twoFactorBackupCodes -emailVerificationToken')
      .populate('adminNotes.addedBy', 'name email role');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const wallet = await Wallet.findOne({ userId: user._id })
      .select('surveyEarnings taskEarnings offerEarnings referralEarnings freelanceEarnings challengeEarnings totalEarned pendingBalance carryOver lastPaidAt');

    res.json({ success: true, user, earningBreakdown: wallet || {} });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/suspend', protect, requireAdmin, async (req, res) => {
  try {
    const { reason, duration = '7d' } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'reason is required' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const durationMap = { '1d': 1, '7d': 7, '30d': 30 };
    const days = durationMap[duration] || 7;
    const endDate = new Date(Date.now() + days * 86400000);

    const before = { isActive: user.isActive };
    user.isActive = false;
    user.suspensionHistory.push({ reason, duration, suspendedBy: req.user._id, startDate: new Date(), endDate });
    await user.save();

    await logAdminAction({
      req,
      admin: req.user,
      actionType: 'suspend_user',
      targetUserId: user._id,
      targetEntity: 'User',
      actionDescription: `Suspended user ${user.name}`,
      reasonEntered: reason,
      beforeState: before,
      afterState: { isActive: false, endDate },
    });

    await createNotification({
      userId: user._id,
      type: 'account_suspended',
      title: 'Account suspended',
      message: `Your account has been suspended for ${duration}. Reason: ${reason}`,
      metadata: { duration, reason },
    });

    res.json({ success: true, message: 'User suspended', endDate });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/reactivate', protect, requireAdmin, async (req, res) => {
  try {
    const { reason = 'Suspension lifted' } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isActive = true;
    await user.save();

    await logAdminAction({
      req,
      admin: req.user,
      actionType: 'reactivate_user',
      targetUserId: user._id,
      targetEntity: 'User',
      actionDescription: `Reactivated user ${user.name}`,
      reasonEntered: reason,
      beforeState: { isActive: false },
      afterState: { isActive: true },
    });

    await createNotification({
      userId: user._id,
      type: 'account_reactivated',
      title: 'Account reactivated',
      message: 'Your account has been reactivated.',
    });
    res.json({ success: true, message: 'User reactivated' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/notes', protect, requireAdmin, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ success: false, message: 'text is required' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $push: { adminNotes: { text, addedBy: req.user._id, addedAt: new Date() } } },
      { new: true }
    ).select('adminNotes');

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, notes: user.adminNotes });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/flag', protect, requireAdmin, async (req, res) => {
  try {
    const { flagged, reason = '' } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const before = { flagStatus: user.flagStatus };
    user.flagStatus = flagged ? 'flagged' : 'clean';
    user.flagReason = flagged ? reason : null;
    await user.save();

    await logAdminAction({
      req,
      admin: req.user,
      actionType: flagged ? 'flag_account' : 'unflag_account',
      targetUserId: user._id,
      targetEntity: 'User',
      actionDescription: `${flagged ? 'Flagged' : 'Unflagged'} account for ${user.name}`,
      reasonEntered: reason || 'No reason given',
      beforeState: before,
      afterState: { flagStatus: user.flagStatus },
    });

    res.json({ success: true, flagStatus: user.flagStatus });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/adjust-xp', protect, requireAdmin, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'reason is required' });
    if (typeof amount !== 'number') return res.status(400).json({ success: false, message: 'amount must be a number' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const before = { xpPoints: user.xpPoints };
    user.xpPoints = Math.max(0, user.xpPoints + amount);
    user.checkLevelUp();
    await user.save();

    await logAdminAction({
      req,
      admin: req.user,
      actionType: 'adjust_xp',
      targetUserId: user._id,
      targetEntity: 'User',
      actionDescription: `Adjusted XP by ${amount} for ${user.name}`,
      reasonEntered: reason,
      beforeState: before,
      afterState: { xpPoints: user.xpPoints },
    });

    res.json({ success: true, xpPoints: user.xpPoints });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/adjust-tokens', protect, requireAdmin, async (req, res) => {
  try {
    const { amount, reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'reason is required' });
    if (typeof amount !== 'number') return res.status(400).json({ success: false, message: 'amount must be a number' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const before = { tokenBalance: user.tokenBalance };
    user.tokenBalance = Math.max(0, user.tokenBalance + amount);
    await user.save();

    await logAdminAction({
      req,
      admin: req.user,
      actionType: 'adjust_tokens',
      targetUserId: user._id,
      targetEntity: 'User',
      actionDescription: `Adjusted tokens by ${amount} for ${user.name}`,
      reasonEntered: reason,
      beforeState: before,
      afterState: { tokenBalance: user.tokenBalance },
    });

    res.json({ success: true, tokenBalance: user.tokenBalance });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/module-access', protect, requireAdmin, async (req, res) => {
  try {
    const { module, enabled, reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'reason is required' });

    const VALID_MODULES = ['remoteJobs','surveys','microtasks','ads','offerwalls','cashTasks','dailyChallenges','jobChats','referAndEarn'];
    if (!VALID_MODULES.includes(module)) return res.status(400).json({ success: false, message: 'Invalid module' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const before = { [module]: user.moduleAccess[module] };
    user.moduleAccess[module] = Boolean(enabled);
    await user.save();

    await logAdminAction({
      req,
      admin: req.user,
      actionType: 'set_module_access',
      targetUserId: user._id,
      targetEntity: 'User',
      actionDescription: `Set module ${module} to ${enabled} for ${user.name}`,
      reasonEntered: reason,
      beforeState: before,
      afterState: { [module]: Boolean(enabled) },
    });

    res.json({ success: true, moduleAccess: user.moduleAccess });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/:id/earning-cap', protect, requireAdmin, async (req, res) => {
  try {
    const { weeklyCapUSD, reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'reason is required' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { weeklyEarningCap: weeklyCapUSD || null },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await logAdminAction({
      req,
      admin: req.user,
      actionType: 'set_earning_cap',
      targetUserId: user._id,
      targetEntity: 'User',
      actionDescription: `Set weekly earning cap to $${weeklyCapUSD} for ${user.name}`,
      reasonEntered: reason,
      beforeState: null,
      afterState: { weeklyEarningCap: weeklyCapUSD },
    });

    res.json({ success: true, weeklyEarningCap: user.weeklyEarningCap });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/:id/badges', protect, requireAdmin, async (req, res) => {
  try {
    const { badge, reason } = req.body;
    if (!badge || !reason) return res.status(400).json({ success: false, message: 'badge and reason required' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $addToSet: { badges: badge } },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await logAdminAction({
      req,
      admin: req.user,
      actionType: 'award_badge',
      targetUserId: user._id,
      targetEntity: 'User',
      actionDescription: `Awarded badge "${badge}" to ${user.name}`,
      reasonEntered: reason,
      beforeState: null,
      afterState: { badge },
    });

    res.json({ success: true, badges: user.badges });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/:id/badges/:badge', protect, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'reason is required' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $pull: { badges: req.params.badge } },
      { new: true }
    );
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    await logAdminAction({
      req,
      admin: req.user,
      actionType: 'revoke_badge',
      targetUserId: user._id,
      targetEntity: 'User',
      actionDescription: `Revoked badge "${req.params.badge}" from ${user.name}`,
      reasonEntered: reason,
      beforeState: null,
      afterState: { badge: req.params.badge },
    });

    res.json({ success: true, badges: user.badges });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/audit-trail', protect, async (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Superadmin only' });
    }
    const AdminAuditTrail = require('../models/AdminAuditTrail');
    const { page = 1, limit = 100, adminId, actionType, targetUserId, dateFrom, dateTo } = req.query;
    const query = {};
    if (adminId) query.adminId = adminId;
    if (actionType) query.actionType = actionType;
    if (targetUserId) query.targetUserId = targetUserId;
    if (dateFrom || dateTo) {
      query.timestampEAT = {};
      if (dateFrom) query.timestampEAT.$gte = new Date(dateFrom);
      if (dateTo) query.timestampEAT.$lte = new Date(dateTo);
    }

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const [logs, total] = await Promise.all([
      AdminAuditTrail.find(query)
        .populate('adminId', 'name email role')
        .populate('targetUserId', 'name email userId')
        .sort({ timestampEAT: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit),
      AdminAuditTrail.countDocuments(query),
    ]);

    res.json({ success: true, logs, pagination: { total, page: safePage, limit: safeLimit } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
