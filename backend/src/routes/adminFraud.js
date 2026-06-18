const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const IpLog = require('../models/IpLog');
const FraudAlert = require('../models/FraudAlert');
const User = require('../models/User');
const { logAdminAction } = require('../utils/adminAudit');

router.get('/overview', protect, requireAdmin, async (req, res) => {
  try {
    const sharedIps = await IpLog.aggregate([
      { $group: { _id: '$ip', userCount: { $sum: 1 }, users: { $push: '$userId' } } },
      { $match: { userCount: { $gte: 2 } } },
      { $sort: { userCount: -1 } },
      { $limit: 50 },
    ]);

    const [flaggedIps, blockedIps, openAlerts] = await Promise.all([
      IpLog.countDocuments({ flagged: true }),
      IpLog.countDocuments({ blocked: true }),
      FraudAlert.countDocuments({ status: 'open' }),
    ]);

    const alerts = await FraudAlert.find({ status: 'open' })
      .populate('relatedUserIds', 'name email userId country')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      success: true,
      stats: {
        totalSharedIpGroups: sharedIps.length,
        flaggedIps,
        blockedIps,
        openAlerts,
      },
      sharedIps,
      alerts,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/ip-logs', protect, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 100, flagged, blocked, search = '' } = req.query;
    const query = {};
    if (flagged === 'true') query.flagged = true;
    if (blocked === 'true') query.blocked = true;
    if (search) query.ip = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);

    const [logs, total] = await Promise.all([
      IpLog.find(query)
        .populate('userId', 'name email phone userId country activationStatus isBanned')
        .sort({ lastSeen: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit),
      IpLog.countDocuments(query),
    ]);

    res.json({ success: true, logs, pagination: { total, page: safePage, limit: safeLimit } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/ip-logs/:ip/accounts', protect, requireAdmin, async (req, res) => {
  try {
    const records = await IpLog.find({ ip: req.params.ip })
      .populate('userId', 'name email phone userId country activationStatus isBanned createdAt');
    res.json({ success: true, ip: req.params.ip, accounts: records.map((r) => r.userId) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/shared-ips', protect, requireAdmin, async (req, res) => {
  try {
    const groups = await IpLog.aggregate([
      { $group: { _id: '$ip', userCount: { $sum: 1 }, userIds: { $push: '$userId' } } },
      { $match: { userCount: { $gte: 2 } } },
      { $sort: { userCount: -1 } },
      { $limit: 100 },
    ]);

    const hydrated = await Promise.all(groups.map(async (g) => {
      const users = await User.find({ _id: { $in: g.userIds } })
        .select('name email phone userId country activationStatus isBanned createdAt');
      return { ip: g._id, userCount: g.userCount, users };
    }));

    res.json({ success: true, sharedIpGroups: hydrated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/ip-logs/:ip/flag', protect, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'reason is required' });

    await IpLog.updateMany({ ip: req.params.ip }, { $set: { flagged: true, flagReason: reason } });

    await logAdminAction({
      req,
      admin: req.user,
      actionType: 'flag_ip',
      targetEntity: 'IP',
      actionDescription: `Flagged IP ${req.params.ip}`,
      reasonEntered: reason,
      beforeState: null,
      afterState: { flagged: true },
    });

    res.json({ success: true, message: 'IP flagged' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/ip-logs/:ip/block', protect, requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'reason is required' });

    await IpLog.updateMany({ ip: req.params.ip }, { $set: { blocked: true, flagged: true, flagReason: reason } });

    await logAdminAction({
      req,
      admin: req.user,
      actionType: 'block_ip',
      targetEntity: 'IP',
      actionDescription: `Blocked IP ${req.params.ip}`,
      reasonEntered: reason,
      beforeState: null,
      afterState: { blocked: true },
    });

    res.json({ success: true, message: 'IP blocked' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.delete('/ip-logs/:ip/block', protect, requireAdmin, async (req, res) => {
  try {
    const { reason = 'Unblocked by admin' } = req.body;
    await IpLog.updateMany({ ip: req.params.ip }, { $set: { blocked: false } });

    await logAdminAction({
      req,
      admin: req.user,
      actionType: 'unblock_ip',
      targetEntity: 'IP',
      actionDescription: `Unblocked IP ${req.params.ip}`,
      reasonEntered: reason,
      beforeState: { blocked: true },
      afterState: { blocked: false },
    });

    res.json({ success: true, message: 'IP unblocked' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/alerts', protect, requireAdmin, async (req, res) => {
  try {
    const { status = 'open', severity } = req.query;
    const query = {};
    if (status !== 'all') query.status = status;
    if (severity && severity !== 'all') query.severity = severity;

    const alerts = await FraudAlert.find(query)
      .populate('relatedUserIds', 'name email userId country activationStatus isBanned')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 })
      .limit(200);

    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/alerts/:alertId', protect, requireAdmin, async (req, res) => {
  try {
    const { status, resolution } = req.body;
    const VALID = ['reviewed', 'dismissed', 'actioned'];
    if (!VALID.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });

    const alert = await FraudAlert.findByIdAndUpdate(
      req.params.alertId,
      { status, resolution: resolution || null, reviewedBy: req.user._id, reviewedAt: new Date() },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
