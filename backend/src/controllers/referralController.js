const User = require('../models/User');
const Referral = require('../models/Referral');
const Wallet = require('../models/Wallet');
const logger = require('../utils/logger');
const devAuthStore = require('../services/devAuthStore');

const getCanonicalFrontendUrl = () =>
  (process.env.CANONICAL_FRONTEND_URL || 'https://cashflowhubs.com').replace(/\/+$/, '');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// @GET /api/referrals/dashboard
exports.getReferralDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const wallet = await Wallet.findOne({ userId: user._id });
    const referralCode = String(user.referralCode || '').trim();
    const referralCodeFilter = referralCode ? new RegExp(`^${escapeRegex(referralCode)}$`, 'i') : null;

    const referredUsers = await User.find(
      referralCodeFilter ? { referredBy: referralCodeFilter } : { referredBy: referralCode }
    )
      .select('name country createdAt activationStatus phoneVerified')
      .sort({ createdAt: -1 })
      .limit(200);

    const invitedUsers = referredUsers.filter((u) => !u.activationStatus);
    const activatedUsers = referredUsers.filter((u) => u.activationStatus);

    const referralRecords = await Referral.find({ referrerUserId: user._id })
      .populate('newUserId', 'name country createdAt activationStatus phoneVerified')
      .sort({ createdAt: -1 })
      .limit(100);

    const totalInvited = referredUsers.length;
    const totalReferred = activatedUsers.length;

    res.json({
      success: true,
      totalInvited,
      totalReferred,
      invitedCount: totalInvited,
      activatedCount: totalReferred,
      totalEarnedUSD: wallet?.referralEarnings || 0,
      referralCode: user.referralCode,
      referralLink: `${getCanonicalFrontendUrl()}/register?ref=${user.referralCode}`,
      invited: invitedUsers.map((u) => ({
        name: u.name,
        country: u.country,
        joinedAt: u.createdAt,
        activated: false,
      })),
      referred: activatedUsers.map((u) => {
        const rewardRecord = referralRecords.find(
          (r) => String(r.newUserId?._id || r.newUserId) === String(u._id)
        );
        return {
          name: u.name || 'Unknown',
          country: u.country || '—',
          joinedAt: u.createdAt,
          activated: true,
          rewardUSD: rewardRecord?.rewardAmountUSD || 0,
          rewardLocal: rewardRecord?.rewardAmountLocal || 0,
          currency: rewardRecord?.currency || 'USD',
          status: rewardRecord?.status || (u.activationStatus ? 'paid' : 'pending'),
          paidAt: rewardRecord?.paidAt || null,
        };
      }),
    });
  } catch (error) {
    logger.error(`getReferralDashboard error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/referrals/leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await Referral.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'newUserId',
          foreignField: '_id',
          as: 'referredUser',
        },
      },
      { $unwind: '$referredUser' },
      { $match: { 'referredUser.activationStatus': true } },
      {
        $group: {
          _id: '$referrerUserId',
          activeReferrals: { $sum: 1 },
        },
      },
      { $sort: { activeReferrals: -1 } },
      { $limit: 20 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'referrer',
        },
      },
      { $unwind: '$referrer' },
      {
        $project: {
          _id: 0,
          name: '$referrer.name',
          country: '$referrer.country',
          level: '$referrer.level',
          totalReferrals: '$activeReferrals',
        },
      },
    ]);

    res.json({ success: true, leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/referrals/validate/:code
exports.validateReferralCode = async (req, res) => {
  try {
    const { code } = req.params;
    let referrer = await User.findOne({ referralCode: code }).select('name country');
    if (!referrer) {
      const devRef = devAuthStore.findByReferralCode(code);
      if (devRef) {
        return res.json({ success: true, referrer: { name: devRef.name, country: devRef.country } });
      }
      return res.status(404).json({ success: false, message: 'Invalid referral code' });
    }
    res.json({ success: true, referrer: { name: referrer.name, country: referrer.country } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
