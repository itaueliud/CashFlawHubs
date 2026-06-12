const express = require('express');
const router = express.Router();
const { getReferralDashboard, getLeaderboard, validateReferralCode } = require('../controllers/referralController');
const { protect } = require('../middleware/auth');

router.get('/dashboard', protect, getReferralDashboard);

router.get('/summary', protect, async (req, res) => {
  try {
    const User = require('../models/User');
    const Referral = require('../models/Referral');
    const Wallet = require('../models/Wallet');

    const user = await User.findById(req.user.id).select('referralCode totalReferrals');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const referralCode = String(user.referralCode || '').trim();
    const escapedCode = referralCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const referralCodeFilter = referralCode ? new RegExp(`^${escapedCode}$`, 'i') : null;

    const [invitedUsers, referralRecords, wallet] = await Promise.all([
      User.find(referralCodeFilter ? { referredBy: referralCodeFilter } : { referredBy: referralCode }).select('_id name country createdAt'),
      Referral.find({ referrerUserId: req.user.id })
        .select('newUserId createdAt rewardAmountLocal currency status')
        .populate('newUserId', 'name country createdAt'),
      Wallet.findOne({ userId: req.user.id }).select('referralEarnings pendingBalance'),
    ]);

    const activatedUserIds = new Set(
      referralRecords
        .filter((record) => record.newUserId)
        .map((record) => record.newUserId._id.toString())
    );

    const totalInvited = new Set([
      ...invitedUsers.map((u) => u._id.toString()),
      ...activatedUserIds,
    ]).size;

    const totalReferred = Math.max(
      new Set(referralRecords.map((record) => record.newUserId?._id?.toString()).filter(Boolean)).size,
      Number(user.totalReferrals || 0)
    );

    const recentReferred = referralRecords
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    const recentInvited = invitedUsers
      .filter((u) => !activatedUserIds.has(u._id.toString()))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    res.json({
      success: true,
      totalInvited,
      totalReferred,
      invitedCount: totalInvited,
      activatedCount: totalReferred,
      totalEarnedUSD: wallet?.referralEarnings || 0,
      pendingUSD: wallet?.pendingBalance || 0,
      recentReferred: recentReferred.map((r) => ({
        name: r.newUserId?.name || 'User',
        country: r.newUserId?.country || '—',
        date: r.createdAt,
        reward: r.rewardAmountLocal,
        currency: r.currency,
        status: r.status,
      })),
      recentInvited: recentInvited.map((u) => ({
        name: u.name,
        country: u.country,
        date: u.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/leaderboard', getLeaderboard);
router.get('/validate/:code', validateReferralCode);

module.exports = router;
