const User = require('../models/User');
const Referral = require('../models/Referral');
const Wallet = require('../models/Wallet');
const logger = require('../utils/logger');

// @GET /api/referrals/dashboard
exports.getReferralDashboard = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const wallet = await Wallet.findOne({ userId: user._id });

    const referrals = await Referral.find({ referrerUserId: user._id })
      .populate('newUserId', 'name country createdAt activationStatus')
      .sort({ createdAt: -1 })
      .limit(50);

    const stats = {
      totalReferrals: user.totalReferrals,
      totalEarnedUSD: wallet?.referralEarnings || 0,
      referralCode: user.referralCode,
      referralLink: `${process.env.FRONTEND_URL}/signup?ref=${user.referralCode}`,
      referrals: referrals.map(r => ({
        user: r.newUserId,
        rewardUSD: r.rewardAmountUSD,
        status: r.status,
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
    const topReferrers = await User.find({ totalReferrals: { $gt: 0 } })
      .select('name totalReferrals country level badges')
      .sort({ totalReferrals: -1 })
      .limit(20);

    res.json({ success: true, leaderboard: topReferrers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/referrals/validate/:code
exports.validateReferralCode = async (req, res) => {
  try {
    const { code } = req.params;
    const referrer = await User.findOne({ referralCode: code }).select('name country');
    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Invalid referral code' });
    }
    res.json({ success: true, referrer: { name: referrer.name, country: referrer.country } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
