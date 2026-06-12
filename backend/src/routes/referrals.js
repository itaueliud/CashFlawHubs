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

    const user = await User.findById(req.user.id).select('referralCode');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const referralCode = String(user.referralCode || '').trim();
    const escapedCode = referralCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const referralCodeFilter = referralCode ? new RegExp(`^${escapedCode}$`, 'i') : null;

    const referredUsers = await User.find(
      referralCodeFilter ? { referredBy: referralCodeFilter } : { referredBy: referralCode }
    )
      .select('name country createdAt activationStatus')
      .sort({ createdAt: -1 })
      .limit(200);

    const invited = referredUsers.filter((u) => !u.activationStatus);
    const activated = referredUsers.filter((u) => u.activationStatus);

    const referralRecords = await Referral.find({ referrerUserId: req.user.id })
      .select('newUserId createdAt rewardAmountLocal currency status')
      .populate('newUserId', 'name country createdAt');

    const wallet = await Wallet.findOne({ userId: req.user.id }).select('referralEarnings pendingBalance');

    res.json({
      success: true,
      totalInvited: referredUsers.length,
      totalReferred: activated.length,
      invitedCount: referredUsers.length,
      activatedCount: activated.length,
      totalEarnedUSD: wallet?.referralEarnings || 0,
      pendingUSD: wallet?.pendingBalance || 0,
      recentInvited: invited.slice(0, 5).map((u) => ({
        name: u.name,
        country: u.country,
        date: u.createdAt,
      })),
      recentReferred: activated.slice(0, 5).map((u) => {
        const rewardRecord = referralRecords.find((r) => String(r.newUserId?._id || r.newUserId) === String(u._id));
        return {
          name: u.name,
          country: u.country,
          date: u.createdAt,
          reward: rewardRecord?.rewardAmountLocal || 0,
          currency: rewardRecord?.currency || 'USD',
          status: rewardRecord?.status || 'paid',
        };
      }),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/leaderboard', getLeaderboard);
router.get('/validate/:code', validateReferralCode);

module.exports = router;
