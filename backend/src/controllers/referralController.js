const User = require('../models/User');
const Referral = require('../models/Referral');
const Wallet = require('../models/Wallet');
const logger = require('../utils/logger');
const devAuthStore = require('../services/devAuthStore');

const getCanonicalFrontendUrl = () =>
  (process.env.CANONICAL_FRONTEND_URL || 'https://cashflowhubs.com').replace(/\/+$/, '');

// @GET /api/referrals/dashboard
exports.getReferralDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const wallet = await Wallet.findOne({ userId: user._id });

    const referrals = await Referral.find({ referrerUserId: user._id })
      .populate('newUserId', 'name country createdAt activationStatus')
      .sort({ createdAt: -1 })
      .limit(50);

    const activeReferrals = referrals.filter(
      (r) => r.newUserId?.activationStatus === true
    );

    const stats = {
      totalReferrals: activeReferrals.length,
      totalEarnedUSD: wallet?.referralEarnings || 0,
      referralCode: user.referralCode,
      referralLink: `${getCanonicalFrontendUrl()}/register?ref=${user.referralCode}`,
      referrals: referrals.map((r) => ({
        user: r.newUserId,
        rewardUSD: r.rewardAmountUSD,
        status: r.newUserId?.activationStatus ? r.status : 'pending',
        activated: r.newUserId?.activationStatus || false,
        date: r.createdAt,
      })),
    };

    res.json({ success: true, ...stats });
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
      // Fallback to local dev auth store when MongoDB doesn't have the code
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
