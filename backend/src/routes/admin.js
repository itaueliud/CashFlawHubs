const express = require('express');
const router = express.Router();
const { protect, adminOnly, staffOnly, ledgerOrSuperadminOnly } = require('../middleware/auth');
const requireAdmin = require('../middleware/requireAdmin');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const Challenge = require('../models/Challenge').Challenge;
const Referral = require('../models/Referral');
const { COUNTRIES } = require('../config/countries');
const { HYBRID_PAYMENT_STACK, PROVIDER_STATUS } = require('../config/paymentStack');
const Wallet = require('../models/Wallet');
const BroadcastCampaign = require('../models/BroadcastCampaign');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const { getRedis, isRedisReady } = require('../config/redis');
const logger = require('../utils/logger');
const { createNotification } = require('../services/notificationCenter');
const { sendCampaign, resolveAudience } = require('../services/broadcastProcessor');

const truthy = (value) => Boolean(value && String(value).trim());
const getLedgerSplitPercent = () => {
  const percent = Number(process.env.LEDGER_SUPERADMIN_SHARE || 60);
  if (Number.isNaN(percent)) return 60;
  return Math.min(Math.max(percent, 51), 100);
};

const getAdminSharePercent = () => 100 - getLedgerSplitPercent();
const normalizeSearch = (value = '') => String(value).trim();
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const canManageTarget = (actor, target) => {
  if (!actor || !target) return false;
  if (actor.role === 'superadmin') return true;
  if (actor.role !== 'admin') return false;
  if (target.role !== 'user') return false;
  if (!target.managedBy) return true;
  return target.managedBy.toString() === actor.id.toString();
};

const getLedgerBaseQuery = (range = '30d') => {
  const now = new Date();
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const from = new Date(now);
  from.setDate(from.getDate() - days);

  return {
    createdAt: { $gte: from, $lte: now },
    status: 'successful',
    type: { $in: ['activation', 'job_posting', 'token_purchase'] },
  };
};

const aggregateLedger = async (range) => {
  const ledgerQuery = getLedgerBaseQuery(range);
  const [summary] = await Transaction.aggregate([
    { $match: ledgerQuery },
    {
      $group: {
        _id: null,
        totalUSD: { $sum: '$amountUSD' },
        totalLocal: { $sum: '$amountLocal' },
        count: { $sum: 1 },
      },
    },
  ]);

  const transactions = await Transaction.find(ledgerQuery)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('userId', 'name email phone role country userId');

  const payoutQueueQuery = {
    createdAt: ledgerQuery.createdAt,
    status: 'pending',
    type: { $in: ['withdrawal', 'referral_reward'] },
  };
  const payoutQueue = await Transaction.find(payoutQueueQuery)
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('userId', 'name email phone role country userId');
  const payoutQueueTotalUSD = payoutQueue.reduce((sum, tx) => sum + Number(tx.amountUSD || 0), 0);

  const totalUSD = summary?.totalUSD || 0;

  return {
    range,
    totalUSD,
    totalLocal: summary?.totalLocal || 0,
    count: summary?.count || 0,
    transactions,
    payoutQueue,
    payoutQueueTotalUSD,
  };
};

const getUserMatchQuery = (term = '') => {
  const normalized = normalizeSearch(term);
  if (!normalized) return null;
  const regex = new RegExp(escapeRegex(normalized), 'i');
  return {
    $or: [
      { name: regex },
      { email: regex },
      { phone: regex },
      { userId: regex },
      { referralCode: regex },
    ],
  };
};

const buildReferralNode = async (user, depth, maxDepth, visited = new Set()) => {
  const nodeId = String(user._id);
  if (visited.has(nodeId)) {
    return null;
  }

  visited.add(nodeId);
  const directReferrals = await User.find({ referredBy: user.referralCode })
    .select('name email phone country role activationStatus referralCode referredBy createdAt userId')
    .sort({ createdAt: 1 })
    .limit(200);

  const directIds = directReferrals.map((ref) => ref._id);
  const directReferralRewards = directIds.length > 0
    ? await Referral.aggregate([
        { $match: { referrerUserId: user._id, newUserId: { $in: directIds } } },
        { $group: { _id: null, totalUSD: { $sum: '$rewardAmountUSD' }, count: { $sum: 1 } } },
      ])
    : [];
  const branchEarningsUSD = Number(directReferralRewards[0]?.totalUSD || 0);

  const children = depth < maxDepth
    ? (await Promise.all(directReferrals.map((child) => buildReferralNode(child, depth + 1, maxDepth, new Set(visited)))))
        .filter(Boolean)
    : [];

  const descendants = children.reduce((sum, child) => sum + 1 + Number(child.descendantCount || 0), 0);
  const activeDescendants = directReferrals.filter((ref) => ref.activationStatus).length
    + children.reduce((sum, child) => sum + Number(child.activeDescendantCount || 0), 0);

  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      userId: user.userId,
      referralCode: user.referralCode,
      country: user.country,
      activationStatus: user.activationStatus,
      role: user.role,
      createdAt: user.createdAt,
    },
    level: depth,
    branchEarningsUSD,
    directCount: directReferrals.length,
    activeDirectCount: directReferrals.filter((ref) => ref.activationStatus).length,
    descendantCount: descendants,
    activeDescendantCount: activeDescendants,
    children,
  };
};

const buildReferralTree = async (user, maxDepth = 3) => {
  const wallet = await Wallet.findOne({ userId: user._id }).select('referralEarnings pendingBalance totalEarned');
  const uplines = [];
  let current = user;
  for (let level = 1; level <= 3; level += 1) {
    if (!current.referredBy) break;
    const parent = await User.findOne({ referralCode: current.referredBy })
      .select('name email phone country role activationStatus referralCode referredBy createdAt userId');
    if (!parent) break;
    uplines.push(parent);
    current = parent;
  }

  const root = await buildReferralNode(user, 0, maxDepth, new Set());
  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      userId: user.userId,
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      country: user.country,
      activationStatus: user.activationStatus,
      role: user.role,
      createdAt: user.createdAt,
    },
    wallet: {
      referralEarnings: wallet?.referralEarnings || 0,
      pendingBalance: wallet?.pendingBalance || 0,
      totalEarned: wallet?.totalEarned || 0,
    },
    uplines,
    tree: root ? [root] : [],
  };
};

const getFraudLevel = (score) => {
  if (score >= 80) return 'high';
  if (score >= 45) return 'medium';
  return 'low';
};

const buildFraudOverview = async () => {
  const [duplicatePhones, duplicateIps, duplicateFingerprints, recentWithdrawals, chargebacks, recentEarnings] = await Promise.all([
    User.aggregate([
      { $match: { phone: { $type: 'string', $ne: '' } } },
      { $group: { _id: '$phone', count: { $sum: 1 }, users: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
    ]),
    User.aggregate([
      { $match: { 'registrationContext.ipAddress': { $type: 'string', $ne: '' } } },
      { $group: { _id: '$registrationContext.ipAddress', count: { $sum: 1 }, users: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } },
    ]),
    User.aggregate([
      { $unwind: { path: '$securityEvents', preserveNullAndEmptyArrays: false } },
      { $match: { 'securityEvents.deviceFingerprint': { $type: 'string', $ne: '' } } },
      { $group: { _id: '$securityEvents.deviceFingerprint', count: { $sum: 1 }, users: { $addToSet: '$_id' }, ips: { $addToSet: '$securityEvents.ipAddress' } } },
      { $match: { count: { $gt: 1 } } },
    ]),
    Transaction.aggregate([
      { $match: { type: 'withdrawal', createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
      { $group: { _id: '$userId', count: { $sum: 1 }, earliest: { $min: '$createdAt' } } },
      { $match: { count: { $gte: 2 } } },
    ]),
    Transaction.find({ status: 'reversed', 'metadata.type': 'chargeback' })
      .populate('userId', 'name email phone country userId referralCode registrationContext createdAt fraudRiskScore fraudRiskLevel fraudReviewStatus fraudRiskReasons')
      .sort({ createdAt: -1 })
      .limit(100),
    Transaction.aggregate([
      { $match: { status: 'successful', createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } },
      { $group: { _id: '$userId', amountUSD: { $sum: '$amountUSD' }, count: { $sum: 1 }, lastAt: { $max: '$createdAt' } } },
      { $match: { amountUSD: { $gte: 100 } } },
    ]),
  ]);

  const scoreMap = new Map();
  const reasonMap = new Map();
  const addScore = (userId, score, reason) => {
    const key = String(userId);
    scoreMap.set(key, Math.min(100, (scoreMap.get(key) || 0) + score));
    const reasons = reasonMap.get(key) || [];
    reasons.push(reason);
    reasonMap.set(key, reasons);
  };

  for (const row of duplicatePhones) {
    row.users.forEach((userId) => addScore(userId, 30, `Shares phone with ${row.count - 1} other account(s)`));
  }
  for (const row of duplicateIps) {
    row.users.forEach((userId) => addScore(userId, 20, `Shares registration IP with ${row.count - 1} other account(s)`));
  }
  for (const row of duplicateFingerprints) {
    row.users.forEach((userId) => addScore(userId, 35, `Shares device fingerprint with ${row.count - 1} other account(s)`));
  }
  for (const row of recentWithdrawals) {
    addScore(row._id, 25, `Multiple withdrawal requests in the last 24 hours (${row.count})`);
  }
  for (const row of recentEarnings) {
    addScore(row._id, 20, `High earnings volume in the last 24 hours ($${Number(row.amountUSD || 0).toFixed(2)})`);
  }

  const flaggedUsers = await User.find({
    _id: { $in: Array.from(scoreMap.keys()) },
  })
    .select('name email phone country userId referralCode role activationStatus isBanned createdAt registrationContext fraudRiskScore fraudRiskLevel fraudReviewStatus fraudRiskReasons fraudReviewedAt')
    .sort({ createdAt: -1 });

  const flagged = flaggedUsers.map((user) => {
    const score = Math.min(100, scoreMap.get(String(user._id)) || 0);
    const reasons = reasonMap.get(String(user._id)) || [];
    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        country: user.country,
        userId: user.userId,
        referralCode: user.referralCode,
        activationStatus: user.activationStatus,
        isBanned: user.isBanned,
        createdAt: user.createdAt,
        registrationIp: user.registrationContext?.ipAddress || '',
        deviceFingerprint: user.registrationContext?.deviceFingerprint || '',
      },
      riskScore: Math.max(score, Number(user.fraudRiskScore || 0)),
      riskLevel: getFraudLevel(Math.max(score, Number(user.fraudRiskScore || 0))),
      reasons: Array.from(new Set([...(user.fraudRiskReasons || []), ...reasons])),
      reviewStatus: user.fraudReviewStatus || 'cleared',
      reviewAt: user.fraudReviewedAt || null,
    };
  }).sort((a, b) => b.riskScore - a.riskScore);

  const chargebackRows = chargebacks.map((tx) => ({
    _id: tx._id,
    user: tx.userId,
    amountUSD: tx.amountUSD,
    createdAt: tx.createdAt,
    providerTransactionId: tx.providerTransactionId,
    metadata: tx.metadata,
  }));

  return {
    flagged,
    duplicatePhones: duplicatePhones.length,
    duplicateIps: duplicateIps.length,
    duplicateIpDetails: duplicateIps.slice(0, 25).map((row) => ({
      ipAddress: row._id,
      count: row.count,
      userIds: row.users,
    })),
    duplicateFingerprints: duplicateFingerprints.length,
    duplicateFingerprintDetails: duplicateFingerprints.slice(0, 25).map((row) => ({
      fingerprint: row._id,
      count: row.count,
      userIds: row.users,
      ips: row.ips,
    })),
    recentWithdrawalClusters: recentWithdrawals.length,
    chargebacks: chargebackRows,
  };
};

const providerConfigs = {
  daraja: {
    label: 'Safaricom Daraja',
    environment: String(process.env.DARAJA_ENV || process.env.MPESA_ENV || 'sandbox').toLowerCase(),
    required: [
      ['consumerKey', process.env.DARAJA_CONSUMER_KEY || process.env.MPESA_CONSUMER_KEY],
      ['consumerSecret', process.env.DARAJA_CONSUMER_SECRET || process.env.MPESA_CONSUMER_SECRET],
      ['shortcode', process.env.DARAJA_SHORTCODE || process.env.MPESA_SHORTCODE],
      ['passkey', process.env.DARAJA_PASSKEY || process.env.MPESA_PASSKEY],
    ],
    recommended: [
      ['securityCredential', process.env.DARAJA_SECURITY_CREDENTIAL || process.env.MPESA_SECURITY_CREDENTIAL],
      ['initiatorName', process.env.DARAJA_INITIATOR_NAME || process.env.MPESA_INITIATOR_NAME],
      ['till', process.env.DARAJA_TILL || process.env.MPESA_TILL],
    ],
  },
  jenga: {
    label: 'Jenga API',
    environment: 'configured',
    required: [
      ['apiKey', process.env.JENGA_API_KEY],
      ['apiSecret', process.env.JENGA_API_SECRET],
      ['merchantCode', process.env.JENGA_MERCHANT_CODE],
      ['collectionUrl', process.env.JENGA_COLLECTION_URL],
      ['mobileWithdrawalUrl', process.env.JENGA_MOBILE_WITHDRAWAL_URL],
    ],
    recommended: [
      ['sourceAccountNumber', process.env.JENGA_SOURCE_ACCOUNT_NUMBER],
      ['sourceAccountName', process.env.JENGA_SOURCE_ACCOUNT_NAME],
    ],
  },
  paystack: {
    label: 'Paystack',
    environment: process.env.PAYSTACK_SECRET_KEY?.startsWith('sk_live') ? 'live' : 'test',
    required: [
      ['secretKey', process.env.PAYSTACK_SECRET_KEY],
      ['publicKey', process.env.PAYSTACK_PUBLIC_KEY],
    ],
    recommended: [],
  },
  pawapay: {
    label: 'PawaPay',
    environment: process.env.PAWAPAY_BASE_URL ? 'configured' : 'missing',
    required: [
      ['apiKey', process.env.PAWAPAY_API_KEY],
      ['merchantId', process.env.PAWAPAY_MERCHANT_ID],
      ['baseUrl', process.env.PAWAPAY_BASE_URL],
    ],
    recommended: [
      ['collectionUrl', process.env.PAWAPAY_COLLECTION_URL],
      ['payoutUrl', process.env.PAWAPAY_PAYOUT_URL],
      ['callbackUrl', process.env.PAWAPAY_CALLBACK_URL],
    ],
  },
  mtn_momo: {
    label: 'MTN MoMo',
    environment: process.env.MTN_MOMO_TARGET_ENVIRONMENT || 'sandbox',
    required: [
      ['subscriptionKey', process.env.MTN_MOMO_SUBSCRIPTION_KEY],
      ['apiUser', process.env.MTN_MOMO_API_USER],
      ['apiKey', process.env.MTN_MOMO_API_KEY],
      ['baseUrl', process.env.MTN_MOMO_BASE_URL],
    ],
    recommended: [],
  },
  telebirr: {
    label: 'Telebirr',
    environment: process.env.TELEBIRR_BASE_URL ? 'configured' : 'missing',
    required: [
      ['appId', process.env.TELEBIRR_APP_ID],
      ['appKey', process.env.TELEBIRR_APP_KEY],
      ['merchantId', process.env.TELEBIRR_MERCHANT_ID],
      ['baseUrl', process.env.TELEBIRR_BASE_URL],
    ],
    recommended: [
      ['notifyUrl', process.env.TELEBIRR_NOTIFY_URL],
    ],
  },
  tanzania_wallet: {
    label: 'Tanzania Wallet',
    environment: process.env.TANZANIA_WALLET_PROVIDER || 'configured',
    required: [
      ['depositUrl', process.env.TANZANIA_WALLET_DEPOSIT_URL],
      ['withdrawalUrl', process.env.TANZANIA_WALLET_WITHDRAWAL_URL],
      ['apiKey', process.env.TANZANIA_WALLET_API_KEY],
      ['apiSecret', process.env.TANZANIA_WALLET_API_SECRET],
    ],
    recommended: [
      ['provider', process.env.TANZANIA_WALLET_PROVIDER],
    ],
  },
};

router.get('/stats', protect, requireAdmin, async (req, res) => {
  try {
    const [totalUsers, activeUsers, totalTransactions, pendingKyc, bannedUsers, recentLogins] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ activationStatus: true }),
      Transaction.countDocuments({ status: 'successful' }),
      User.countDocuments({ identityVerificationStatus: { $in: ['pending', 'submitted'] } }),
      User.countDocuments({ isBanned: true }),
      User.countDocuments({ lastLoginAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    ]);
    
    const { Challenge } = require('../models/Challenge');
    const activeChallenges = await Challenge.countDocuments({ isActive: true, expiresAt: { $gt: new Date() } });
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        totalTransactions,
        pendingKyc,
        bannedUsers,
        recentLogins,
        activeChallenges,
        userGrowthTrend: Math.round((activeUsers / Math.max(totalUsers, 1)) * 100),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/referrals/search', protect, requireAdmin, async (req, res) => {
  try {
    const query = getUserMatchQuery(req.query.query || req.query.search || '');
    if (!query) {
      return res.json({ success: true, users: [] });
    }

    const users = await User.find(query)
      .select('name email phone userId referralCode country activationStatus role createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/referrals/tree/:userId', protect, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('name email phone userId referralCode referredBy country activationStatus role createdAt');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const tree = await buildReferralTree(user, 3);
    res.json({
      success: true,
      ...tree,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Fraud Detection - flagged accounts
router.get('/fraud/flagged', protect, staffOnly, async (req, res) => {
  try {
    const User = require('../models/User');
    const Transaction = require('../models/Transaction');
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Withdrew within 30 mins of activating
    const fastWithdrawals = await Transaction.find({ type: 'withdrawal', status: 'successful' }).populate('userId', 'name email phone country createdAt activationStatus');
    const fastWithdrawUsers = fastWithdrawals
      .filter(tx => {
        const user = tx.userId;
        if (!user?.createdAt) return false;
        return (new Date(tx.createdAt) - new Date(user.createdAt)) <= (30 * 60 * 1000);
      })
      .map(tx => ({
        user: tx.userId, reason: 'Withdrew within 30min of activation',
        riskScore: 90, txId: tx._id, amount: tx.amountUSD
      }));

    // 2. Duplicate phone numbers
    const dupPhones = await User.aggregate([
      { $group: { _id: '$phone', count: { $sum: 1 }, users: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ]);
    const dupPhoneUsers = [];
    for (const g of dupPhones) {
      const users = await User.find({ _id: { $in: g.users } }).select('name email phone country createdAt');
      users.forEach(u => dupPhoneUsers.push({
        user: u, reason: `Duplicate phone shared with ${g.count - 1} other account(s)`,
        riskScore: 75
      }));
    }

    // 3. Offerwall spikes - completed > 20 offers in 24h
    const offerSpikes = await Transaction.aggregate([
      { $match: { type: 'offer', createdAt: { $gte: oneDayAgo } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $match: { count: { $gt: 20 } } }
    ]);
    const spikeUsers = [];
    for (const s of offerSpikes) {
      const u = await User.findById(s._id).select('name email phone country');
      if (u) spikeUsers.push({
        user: u, reason: `Completed ${s.count} offers in 24h (spike)`, riskScore: 80
      });
    }

    // 4. Referral earnings with no self-earning
    const referralOnly = await User.aggregate([
      { $match: { activationStatus: true } },
      {
        $lookup: {
          from: 'wallets', localField: '_id', foreignField: 'userId', as: 'wallet'
        }
      },
      { $unwind: '$wallet' },
      {
        $match: {
          'wallet.referralEarnings': { $gt: 0 },
          'wallet.surveyEarnings': 0,
          'wallet.taskEarnings': 0,
          'wallet.offerEarnings': 0,
        }
      },
      { $limit: 50 }
    ]);
    const refOnlyUsers = referralOnly.map(u => ({
      user: { _id: u._id, name: u.name, email: u.email, phone: u.phone, country: u.country },
      reason: 'Has referral earnings but zero self-earned activity',
      riskScore: 60
    }));

    const allFlags = [...fastWithdrawUsers, ...dupPhoneUsers, ...spikeUsers, ...refOnlyUsers];
    const seen = new Set();
    const unique = allFlags.filter(f => {
      const id = String(f.user?._id);
      if (seen.has(id)) return false;
      seen.add(id); return true;
    }).sort((a, b) => b.riskScore - a.riskScore);

    res.json({ success: true, flagged: unique, total: unique.length });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Revenue analytics
router.get('/analytics/revenue', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const days = req.query.range === '7d' ? 7 : req.query.range === '90d' ? 90 : 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [daily, bySource, byCountry, withdrawalTotal] = await Promise.all([
      Transaction.aggregate([
        { $match: { type: { $in: ['activation','job_posting','token_purchase'] }, status: 'successful', createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, totalUSD: { $sum: '$amountUSD' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: ['activation','job_posting','token_purchase'] }, status: 'successful', createdAt: { $gte: since } } },
        { $group: { _id: '$type', totalUSD: { $sum: '$amountUSD' }, count: { $sum: 1 } } }
      ]),
      Transaction.aggregate([
        { $match: { type: { $in: ['activation','job_posting','token_purchase'] }, status: 'successful', createdAt: { $gte: since } } },
        { $group: { _id: '$country', totalUSD: { $sum: '$amountUSD' }, count: { $sum: 1 } } },
        { $sort: { totalUSD: -1 } }, { $limit: 10 }
      ]),
      Transaction.aggregate([
        { $match: { type: 'withdrawal', status: 'successful', createdAt: { $gte: since } } },
        { $group: { _id: null, totalUSD: { $sum: '$amountUSD' } } }
      ])
    ]);

    const totalRevenue = bySource.reduce((s, r) => s + r.totalUSD, 0);
    const totalWithdrawn = withdrawalTotal[0]?.totalUSD || 0;

    res.json({
      success: true,
      daily,
      bySource,
      byCountry,
      totalRevenue,
      totalWithdrawn,
      ratio: totalRevenue > 0 ? ((totalWithdrawn / totalRevenue) * 100).toFixed(1) : 0
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Withdrawal approval queue
router.get('/withdrawals/pending-approval', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const THRESHOLD_USD = parseFloat(process.env.WITHDRAWAL_APPROVAL_THRESHOLD_USD || '50');
    const pending = await Transaction.find({
      type: 'withdrawal',
      status: 'pending',
      amountUSD: { $gte: THRESHOLD_USD }
    }).populate('userId', 'name email phone country').sort({ createdAt: -1 });
    res.json({ success: true, withdrawals: pending, threshold: THRESHOLD_USD });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/withdrawals/:id/approve', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const { logAudit } = require('../utils/audit');
    const tx = await Transaction.findById(req.params.id);
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found' });
    if (tx.status !== 'pending') return res.status(400).json({ success: false, message: 'Not pending' });
    tx.metadata = { ...tx.metadata, approvedBy: req.user._id, approvedAt: new Date() };
    await tx.save();
    await logAudit({ req, actor: req.user, module: 'withdrawals', action: 'approve_withdrawal', targetType: 'transaction', targetId: tx._id, metadata: { amountUSD: tx.amountUSD } });
    res.json({ success: true, message: 'Withdrawal approved' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.post('/withdrawals/:id/reject', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const Transaction = require('../models/Transaction');
    const Wallet = require('../models/Wallet');
    const { logAudit } = require('../utils/audit');
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Reason required' });
    const tx = await Transaction.findById(req.params.id);
    if (!tx || tx.status !== 'pending') return res.status(400).json({ success: false, message: 'Not pending' });
    tx.status = 'failed';
    tx.failureReason = reason;
    await tx.save();
    const wallet = await Wallet.findOne({ userId: tx.userId });
    if (wallet) { wallet.balanceUSD += tx.amountUSD; await wallet.save(); }
    await logAudit({ req, actor: req.user, module: 'withdrawals', action: 'reject_withdrawal', targetType: 'transaction', targetId: tx._id, metadata: { amountUSD: tx.amountUSD, reason } });
    res.json({ success: true, message: 'Withdrawal rejected and wallet refunded' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// KYC queue
router.get('/kyc/queue', protect, requireAdmin, async (req, res) => {
  try {
    const User = require('../models/User');
    const {
      search = '',
      country = '',
      page = 1,
      limit = 25,
    } = req.query;

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
    const query = { identityVerificationStatus: 'submitted' };

    const normalizedSearch = String(search || '').trim();
    if (normalizedSearch) {
      const regex = new RegExp(escapeRegex(normalizedSearch), 'i');
      query.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { userId: regex },
        { referralCode: regex },
      ];
    }

    if (country) {
      query.country = String(country).trim();
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .select('name email phone country userId createdAt identityVerificationStatus idNumber idDocumentImage faceVerificationImage balanceUSD referralCode fraudRiskScore fraudRiskLevel registrationContext')
        .sort({ createdAt: 1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      queue: users,
      count: total,
      pagination: { total, page: safePage, limit: safeLimit },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// User activity timeline
router.get('/users/:id/timeline', protect, requireAdmin, async (req, res) => {
  try {
    const User = require('../models/User');
    const Transaction = require('../models/Transaction');
    const AuditLog = require('../models/AuditLog');
    const { Challenge, ChallengeCompletion } = require('../models/Challenge');

    const [user, transactions, auditEvents] = await Promise.all([
      User.findById(req.params.id).select('name email phone createdAt activationStatus identityVerificationStatus twoFactorEnabled twoFactorEnabledAt phoneVerified emailVerified loginHistory'),
      Transaction.find({ userId: req.params.id }).sort({ createdAt: -1 }).limit(100),
      AuditLog.find({ targetId: String(req.params.id) }).sort({ createdAt: -1 }).limit(50)
    ]);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const timeline = [
      { date: user.createdAt, type: 'account', label: 'Account created', icon: 'user' },
      ...(user.phoneVerified ? [{ date: user.createdAt, type: 'verify', label: 'Phone verified', icon: 'phone' }] : []),
      ...(user.twoFactorEnabledAt ? [{ date: user.twoFactorEnabledAt, type: 'security', label: '2FA enabled', icon: 'shield' }] : []),
      ...transactions.map(tx => ({
        date: tx.createdAt, type: 'transaction',
        label: `${tx.type} — $${Number(tx.amountUSD || 0).toFixed(2)} (${tx.status})`,
        icon: tx.direction === 'credit' ? 'arrow-down' : 'arrow-up',
        meta: { status: tx.status, provider: tx.provider, currency: tx.currency }
      })),
      ...auditEvents.map(e => ({
        date: e.createdAt, type: 'admin_action',
        label: `Admin action: ${e.action} by ${e.actorRole}`,
        icon: 'shield-alert', meta: e.metadata
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, user, timeline });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Wallet correction
router.post('/wallets/:userId/correct', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const Wallet = require('../models/Wallet');
    const Transaction = require('../models/Transaction');
    const { logAudit } = require('../utils/audit');
    const { direction, amountUSD, reason, reference } = req.body;
    if (!direction || !amountUSD || !reason || !reference) {
      return res.status(400).json({ success: false, message: 'direction, amountUSD, reason, reference all required' });
    }
    const wallet = await Wallet.findOne({ userId: req.params.userId });
    if (!wallet) return res.status(404).json({ success: false, message: 'Wallet not found' });

    const before = wallet.balanceUSD;
    if (direction === 'credit') wallet.balanceUSD += Number(amountUSD);
    else {
      if (wallet.balanceUSD < Number(amountUSD)) return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
      wallet.balanceUSD -= Number(amountUSD);
    }
    await wallet.save();

    await Transaction.create({
      userId: wallet.userId,
      type: 'wallet_correction',
      status: 'successful',
      direction: direction === 'credit' ? 'credit' : 'debit',
      amountUSD: Number(amountUSD),
      currency: 'USD',
      country: wallet.country || 'USD',
      provider: 'internal',
      metadata: { reason, reference, before, after: wallet.balanceUSD, adjustedBy: req.user._id }
    });

    await logAudit({ req, actor: req.user, module: 'wallets', action: 'wallet_correction', targetType: 'wallet', targetId: wallet._id, metadata: { direction, amountUSD, reason, reference } });

    res.json({ success: true, message: 'Wallet corrected', before, after: wallet.balanceUSD });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Bulk user actions
router.post('/users/bulk', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const User = require('../models/User');
    const { logAudit } = require('../utils/audit');
    const { action, userIds, reason, accessType } = req.body;
    if (!action || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ success: false, message: 'action and userIds required' });
    }
    if (action === 'ban') {
      await User.updateMany({ _id: { $in: userIds } }, { $set: { isBanned: true, banReason: reason || 'Bulk ban' } });
    } else if (action === 'unban') {
      await User.updateMany({ _id: { $in: userIds } }, { $set: { isBanned: false, banReason: null } });
    } else if (action === 'set-access-type') {
      await User.updateMany({ _id: { $in: userIds } }, { $set: { accessType: accessType || 'real' } });
    } else {
      return res.status(400).json({ success: false, message: 'Unknown action' });
    }
    await logAudit({ req, actor: req.user, module: 'users', action: `bulk_${action}`, targetType: 'users', targetId: userIds.join(','), metadata: { count: userIds.length, reason } });
    res.json({ success: true, message: `Bulk ${action} applied to ${userIds.length} users` });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Notification broadcast
router.post('/notifications/broadcast', protect, requireAdmin, async (req, res) => {
  try {
    const { logAudit } = require('../utils/audit');
    const {
      title,
      message,
      htmlMessage = '',
      channel = 'in_app',
      segment = 'all',
      countries = [],
      country = '',
      minBalance = null,
      activatedOnly = false,
      userIds = [],
      userSearch = '',
      sendAt = null,
      metadata = {},
    } = req.body || {};

    if (!title || !message) return res.status(400).json({ success: false, message: 'title and message required' });

    const scheduledFor = sendAt ? new Date(sendAt) : null;
    if (scheduledFor && Number.isNaN(scheduledFor.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid sendAt date' });
    }

    const campaign = await BroadcastCampaign.create({
      title,
      message,
      htmlMessage,
      channel: ['in_app', 'email', 'both'].includes(String(channel)) ? String(channel) : 'in_app',
      target: {
        scope: String(segment || 'all'),
        countries: Array.isArray(countries) && countries.length > 0 ? countries : (country ? [country] : []),
        minBalance: minBalance !== null && minBalance !== '' ? Number(minBalance) : null,
        activatedOnly: Boolean(activatedOnly),
        userIds: Array.isArray(userIds) ? userIds : [],
        userSearch: String(userSearch || ''),
      },
      scheduledFor,
      status: scheduledFor && scheduledFor > new Date() ? 'scheduled' : 'draft',
      createdBy: req.user._id,
      metadata,
    });

    if (!scheduledFor || scheduledFor <= new Date()) {
      await sendCampaign(campaign._id);
    } else {
      campaign.status = 'scheduled';
      await campaign.save();
    }

    await logAudit({
      req,
      actor: req.user,
      module: 'notifications',
      action: campaign.status === 'sent' ? 'broadcast_sent' : 'broadcast_scheduled',
      targetType: 'broadcast_campaign',
      targetId: String(campaign._id),
      metadata: { title, channel, segment, scheduledFor: scheduledFor || null },
    });

    res.json({
      success: true,
      message: campaign.status === 'sent'
        ? `Broadcast sent`
        : `Broadcast scheduled for ${scheduledFor.toISOString()}`,
      campaign,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/fraud/overview', protect, adminOnly, async (req, res) => {
  try {
    const overview = await buildFraudOverview();
    res.json({ success: true, ...overview });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/fraud/:userId/clear', protect, adminOnly, async (req, res) => {
  try {
    const { reason = '' } = req.body || {};
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.fraudRiskScore = 0;
    user.fraudRiskLevel = 'low';
    user.fraudRiskReasons = reason ? [String(reason)] : [];
    user.fraudReviewStatus = 'cleared';
    user.fraudReviewedAt = new Date();
    await user.save();

    const { logAudit } = require('../utils/audit');
    await logAudit({
      req,
      actor: req.user,
      module: 'fraud',
      action: 'fraud_cleared',
      targetType: 'user',
      targetId: user._id,
      metadata: { reason },
    });

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/fraud/:userId/ban', protect, adminOnly, async (req, res) => {
  try {
    const { reason = 'Fraud risk detected' } = req.body || {};
    const user = await User.findById(req.params.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isBanned = true;
    user.banReason = reason;
    user.fraudReviewStatus = 'banned';
    user.fraudReviewedAt = new Date();
    await user.save();

    const { logAudit } = require('../utils/audit');
    await logAudit({
      req,
      actor: req.user,
      module: 'fraud',
      action: 'fraud_banned',
      targetType: 'user',
      targetId: user._id,
      metadata: { reason },
    });

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/notifications/targeted', protect, requireAdmin, async (req, res) => {
  try {
    const User = require('../models/User');
    const { logAudit } = require('../utils/audit');
    const {
      recipients = [],
      title,
      message,
      metadata = {},
      notificationType = 'system',
      channel = 'in_app',
    } = req.body || {};

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'title and message required' });
    }

    const rawRecipients = Array.isArray(recipients)
      ? recipients
      : String(recipients || '')
          .split(/[\n,]+/)
          .map((value) => value.trim())
          .filter(Boolean);

    const tokens = [...new Set(rawRecipients)];
    if (tokens.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one recipient is required' });
    }

    const lowerTokens = tokens.map((value) => value.toLowerCase());
    const users = await User.find({
      $or: [
        { _id: { $in: tokens } },
        { email: { $in: lowerTokens } },
        { phone: { $in: tokens } },
        { userId: { $in: tokens } },
      ],
    }).select('_id email phone userId');

    const uniqueUsers = Array.from(new Map(users.map((user) => [String(user._id), user])).values());
    if (uniqueUsers.length === 0) {
      return res.status(404).json({ success: false, message: 'No matching users found for the provided recipients' });
    }

    const results = await Promise.allSettled(
      uniqueUsers.map((user) =>
        createNotification({
          userId: user._id,
          type: 'system',
          title,
          message,
          channel: ['in_app', 'email', 'sms'].includes(String(channel)) ? String(channel) : 'in_app',
          metadata: {
            ...metadata,
            scope: 'targeted',
            kind: String(notificationType || 'system'),
            createdBy: req.user._id,
          },
        })
      )
    );

    const sent = results.filter((item) => item.status === 'fulfilled' && item.value).length;
    await logAudit({
      req,
      actor: req.user,
      module: 'notifications',
      action: 'targeted_send',
      targetType: 'users',
      targetId: uniqueUsers.map((user) => String(user._id)).join(','),
      metadata: { title, count: sent, notificationType: String(notificationType || 'system'), channel: String(channel || 'in_app') },
    });

    res.json({ success: true, message: `Notification sent to ${sent} users`, count: sent });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/notifications/broadcast/preview', protect, requireAdmin, async (req, res) => {
  try {
    const { segment, country, countries = [], minBalance, activatedOnly, userIds = [], userSearch = '' } = req.query;
    const resolved = await resolveAudience({
      target: {
        scope: String(segment || 'all'),
        countries: Array.isArray(countries) ? countries : String(country || '').split(',').filter(Boolean),
        minBalance: minBalance !== undefined && minBalance !== null && minBalance !== '' ? Number(minBalance) : null,
        activatedOnly: String(activatedOnly) === 'true',
        userIds: Array.isArray(userIds) ? userIds : String(userIds || '').split(',').filter(Boolean),
        userSearch,
      },
    });
    const sample = resolved.slice(0, 5).map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      country: user.country,
      balanceUSD: user.balanceUSD,
    }));
    res.json({ success: true, count: resolved.length, sample });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/notifications/broadcasts/history', protect, requireAdmin, async (req, res) => {
  try {
    const campaigns = await BroadcastCampaign.find({})
      .populate('createdBy', 'name email role userId')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const normalized = await Promise.all(campaigns.map(async (campaign) => {
      const readCount = await Notification.countDocuments({
        'metadata.broadcastId': campaign._id,
        readAt: { $ne: null },
      });
      return {
        ...campaign,
        readCount,
        openRate: campaign.stats?.sent ? Number(((readCount / campaign.stats.sent) * 100).toFixed(1)) : 0,
      };
    }));

    res.json({ success: true, campaigns: normalized });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

router.get('/users', protect, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', role = '', banned = '', verified = '' } = req.query;
    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const query = {};

    if (req.user.role === 'admin') {
      query.role = 'user';
      query.$or = [{ managedBy: req.user._id }, { managedBy: null }];
    } else if (role && ['user', 'admin', 'superadmin'].includes(String(role))) {
      query.role = role;
    } else if (req.user.role === 'superadmin') {
      query.role = 'user';
    }

    if (String(banned) === 'true') query.isBanned = true;
    if (String(banned) === 'false') query.isBanned = false;
    if (String(verified) === 'true') query.activationStatus = true;
    if (String(verified) === 'false') query.activationStatus = false;

    const term = normalizeSearch(search);
    if (term) {
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { name: { $regex: term, $options: 'i' } },
            { email: { $regex: term, $options: 'i' } },
            { phone: { $regex: term, $options: 'i' } },
            { userId: { $regex: term, $options: 'i' } },
          ],
        },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(query)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .select('name email phone country role activationStatus isBanned userId userAccessType createdAt managedBy balanceUSD referralCode fraudRiskScore fraudRiskLevel')
        .lean(),
      User.countDocuments(query),
    ]);
    res.json({ success: true, users, pagination: { total, page: safePage, limit: safeLimit } });
  } catch (error) {
    logger.error(`Admin users list failed: ${error.message}`);
    res.status(500).json({ success: false, message: 'Failed to load users', error: error.message });
  }
});

router.put('/users/:id/ban', protect, requireAdmin, async (req, res) => {
  const targetUser = await User.findById(req.params.id);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (!canManageTarget(req.user, targetUser)) {
    return res.status(403).json({ success: false, message: 'Not allowed to manage this account' });
  }
  if (req.user.role === 'admin' && targetUser.role === 'user') {
    targetUser.managedBy = req.user.id;
    targetUser.managedAt = new Date();
    await targetUser.save();
  }
  const user = await User.findByIdAndUpdate(req.params.id, { isBanned: true, banReason: req.body.reason }, { new: true });
  res.json({ success: true, user });
});

router.put('/users/:id/unban', protect, requireAdmin, async (req, res) => {
  const targetUser = await User.findById(req.params.id);
  if (!targetUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (!canManageTarget(req.user, targetUser)) {
    return res.status(403).json({ success: false, message: 'Not allowed to manage this account' });
  }
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isBanned: false, banReason: null, failedLoginAttempts: 0, lockUntil: null },
    { new: true }
  );
  res.json({ success: true, user });
});

router.put('/users/:id/assign', protect, requireAdmin, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  const { adminId } = req.body;
  const targetAdmin = await User.findById(adminId);
  if (!targetAdmin || !['admin', 'superadmin'].includes(targetAdmin.role)) {
    return res.status(400).json({ success: false, message: 'Valid admin required' });
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { managedBy: targetAdmin._id, managedAt: new Date() },
    { new: true }
  );

  res.json({ success: true, user });
});

// Admin KYC approval/rejection
router.patch('/users/:userId/kyc', protect, requireAdmin, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be verified or rejected' });
    }

    const updates = { identityVerificationStatus: status };

    const user = await User.findByIdAndUpdate(req.params.userId, updates, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // TODO: notify user via email/SMS about result

    res.json({ success: true, message: `KYC ${status}`, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/admins', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const visibleRoles = req.user.role === 'ledger'
    ? ['admin', 'superadmin']
    : ['admin'];
  const admins = await User.find({ role: { $in: visibleRoles } })
    .sort({ createdAt: -1 })
    .select('name email phone role country isBanned isActive lastActiveDate userId createdAt adminAllowedPages');
  res.json({ success: true, admins });
});

router.post('/admins', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const { name, email, phone, country, password, role = 'admin', adminAllowedPages = [] } = req.body;

  if (!name || !email || !phone || !country || !password) {
    return res.status(400).json({ success: false, message: 'Missing required admin fields' });
  }

  const allowedRoles = req.user.role === 'ledger' ? ['admin', 'superadmin'] : ['admin'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ success: false, message: 'Invalid role' });
  }

  const existing = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone }] });
  if (existing) {
    return res.status(409).json({ success: false, message: 'Admin already exists with this email or phone' });
  }

  const admin = await User.create({
    name,
    email: email.toLowerCase(),
    phone,
    country,
    passwordHash: password,
    role,
    activationStatus: true,
    emailVerified: true,
    phoneVerified: true,
    isActive: true,
    adminAllowedPages: Array.isArray(adminAllowedPages) ? adminAllowedPages.filter(Boolean) : [],
  });

  res.status(201).json({ success: true, admin });
});

router.put('/admins/:id/ban', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target || !['admin', 'superadmin'].includes(target.role)) {
    return res.status(404).json({ success: false, message: 'Admin account not found' });
  }
  if (req.user.role === 'superadmin' && target.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Superadmin can only manage admin accounts' });
  }
  if (target._id.toString() === req.user.id.toString()) {
    return res.status(400).json({ success: false, message: 'You cannot block your own account' });
  }
  const admin = await User.findByIdAndUpdate(
    target._id,
    { isBanned: true, banReason: req.body.reason || 'Blocked by superadmin' },
    { new: true }
  ).select('name email phone role country isBanned isActive userId');
  res.json({ success: true, admin });
});

router.put('/admins/:id/unban', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target || !['admin', 'superadmin'].includes(target.role)) {
    return res.status(404).json({ success: false, message: 'Admin account not found' });
  }
  if (req.user.role === 'superadmin' && target.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Superadmin can only manage admin accounts' });
  }
  const admin = await User.findByIdAndUpdate(
    target._id,
    { isBanned: false, banReason: null, failedLoginAttempts: 0, lockUntil: null },
    { new: true }
  ).select('name email phone role country isBanned isActive userId');
  res.json({ success: true, admin });
});

router.put('/users/:id/reset-password', protect, requireAdmin, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
  }
  const target = await User.findById(req.params.id).select('+passwordHash');
  if (!target) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (!canManageTarget(req.user, target)) {
    return res.status(403).json({ success: false, message: 'Not allowed to manage this account' });
  }
  target.passwordHash = String(newPassword);
  target.failedLoginAttempts = 0;
  target.lockUntil = null;
  await target.save();
  res.json({ success: true, message: 'Password updated successfully' });
});

router.put('/users/:id/access-type', protect, requireAdmin, async (req, res) => {
  const accessType = String(req.body?.userAccessType || '').trim().toLowerCase();
  if (!['real', 'test'].includes(accessType)) {
    return res.status(400).json({ success: false, message: 'userAccessType must be real or test' });
  }

  const target = await User.findById(req.params.id);
  if (!target) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  if (!canManageTarget(req.user, target)) {
    return res.status(403).json({ success: false, message: 'Not allowed to manage this account' });
  }

  const previousAccessType = target.userAccessType || 'real';
  target.userAccessType = accessType;
  if (req.user.role === 'admin' && target.role === 'user') {
    target.managedBy = req.user.id;
    target.managedAt = new Date();
  }
  await target.save();

  const { logAudit } = require('../utils/audit');
  await logAudit({
    req,
    actor: req.user,
    module: 'users',
    action: 'access_type_updated',
    targetType: 'user',
    targetId: target._id,
    metadata: {
      userAccessType: accessType,
      previousAccessType,
    },
  });

  res.json({ success: true, user: target, message: `User marked as ${accessType} user` });
});

router.post('/users/:id/activate', protect, requireAdmin, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const target = await User.findById(req.params.id).session(session);
    if (!target) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!canManageTarget(req.user, target)) {
      await session.abortTransaction();
      return res.status(403).json({ success: false, message: 'Not allowed to manage this account' });
    }

    if (target.activationStatus) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'User already activated' });
    }

    target.activationStatus = true;
    if (!target.isActive) target.isActive = true;
    await target.save({ session });

    const transaction = await Transaction.create(
      [{
        userId: target._id,
        type: 'activation',
        amountLocal: 0,
        amountUSD: 0,
        currency: target.country || 'USD',
        country: target.country || 'USD',
        provider: 'internal',
        providerTransactionId: `admin-activation-${target._id}-${Date.now()}`,
        status: 'successful',
        direction: 'credit',
        processedAt: new Date(),
        metadata: {
          activatedBy: req.user._id.toString(),
          activatedByRole: req.user.role,
          activationMethod: 'admin_manual',
        },
      }],
      { session }
    );

    if (target.referredBy) {
      const referrer = await User.findOne({ referralCode: target.referredBy }).session(session);
      if (referrer) {
        const referralRewardUSD = 1.54;
        const referralRewardLocal = referralRewardUSD;
        const currency = target.country || 'USD';

        await Wallet.findOneAndUpdate(
          { userId: referrer._id },
          {
            $inc: {
              pendingBalance: referralRewardUSD,
              referralEarnings: referralRewardUSD,
              totalEarned: referralRewardUSD,
            },
          },
          { session, new: true, upsert: true, setDefaultsOnInsert: true }
        );

        await Transaction.create(
          [{
            userId: referrer._id,
            type: 'referral_reward',
            amountLocal: referralRewardLocal,
            amountUSD: referralRewardUSD,
            currency,
            country: target.country || 'USD',
            provider: 'internal',
            direction: 'credit',
            status: 'pending',
            metadata: {
              sourceUserId: target._id.toString(),
              sourceUserCode: target.userId,
              payoutSchedule: 'friday',
              activationMethod: 'admin_manual',
            },
          }],
          { session }
        );

        await User.findByIdAndUpdate(
          referrer._id,
          { $inc: { totalReferrals: 1, xpPoints: 100 } },
          { session }
        );

        const { updateChallengeProgress } = require('../controllers/challengeController');
        await updateChallengeProgress(referrer._id, 'referral');
        const updatedReferrer = await User.findById(referrer._id).session(session).select('totalReferrals');
        if ((updatedReferrer?.totalReferrals || 0) >= 2) {
          await updateChallengeProgress(referrer._id, 'referral_3');
        }
      }
    }

    await session.commitTransaction();
    res.json({ success: true, message: 'User activated successfully', user: target, transaction: transaction[0] });
  } catch (error) {
    await session.abortTransaction();
    logger.error(`Admin activate user failed: ${error.message}`, { userId: req.user._id.toString(), targetUserId: req.params.id });
    res.status(500).json({ success: false, message: 'Failed to activate user', error: error.message });
  } finally {
    await session.endSession();
  }
});

router.put('/admins/:id/reset-password', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 8) {
    return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });
  }
  const target = await User.findById(req.params.id).select('+passwordHash');
  if (!target || !['admin', 'superadmin'].includes(target.role)) {
    return res.status(404).json({ success: false, message: 'Admin account not found' });
  }
  if (req.user.role === 'superadmin' && target.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Superadmin can only manage admin accounts' });
  }
  target.passwordHash = String(newPassword);
  target.failedLoginAttempts = 0;
  target.lockUntil = null;
  await target.save();
  res.json({ success: true, message: 'Admin password updated successfully' });
});

router.put('/admins/:id/pages', protect, ledgerOrSuperadminOnly, async (req, res) => {
  try {
    const pages = Array.isArray(req.body?.adminAllowedPages)
      ? req.body.adminAllowedPages.map((page) => String(page).trim()).filter(Boolean)
      : null;
    if (!pages) {
      return res.status(400).json({ success: false, message: 'adminAllowedPages array is required' });
    }

    const target = await User.findById(req.params.id);
    if (!target || !['admin', 'superadmin'].includes(target.role)) {
      return res.status(404).json({ success: false, message: 'Admin account not found' });
    }
    if (req.user.role === 'superadmin' && target.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Superadmin can only manage admin accounts' });
    }

    const admin = await User.findByIdAndUpdate(
      target._id,
      { $set: { adminAllowedPages: pages } },
      { new: true, runValidators: true }
    ).select('name email phone role country isBanned isActive lastActiveDate userId createdAt adminAllowedPages');

    res.json({ success: true, message: 'Admin permissions updated successfully', admin });
  } catch (error) {
    logger.error(`Admin pages update failed: ${error.message}`, { userId: req.user?._id?.toString?.() || null, targetUserId: req.params.id });
    res.status(500).json({ success: false, message: 'Failed to update admin permissions', error: error.message });
  }
});

router.delete('/admins/:id', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const target = await User.findById(req.params.id);
  if (!target || !['admin', 'superadmin'].includes(target.role)) {
    return res.status(404).json({ success: false, message: 'Admin account not found' });
  }
  if (target._id.toString() === req.user.id.toString()) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
  }
  if (req.user.role === 'ledger' && target.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Ledger can only delete admin accounts' });
  }
  if (req.user.role === 'superadmin' && target.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Superadmin can only manage admin accounts' });
  }

  await User.findByIdAndDelete(target._id);
  res.json({ success: true, message: 'Admin account deleted successfully' });
});

router.get('/ledger', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const { range = '30d' } = req.query;
  const ledger = await aggregateLedger(range);
  res.json({ success: true, ledger });
});

router.post('/ledger/manual-payment', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      userIdentifier,
      amountUSD,
      amountLocal,
      currency,
      country,
      providerReference,
      paymentMethod,
      note,
    } = req.body || {};

    if (!userIdentifier || amountUSD == null || !providerReference || !paymentMethod) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'userIdentifier, amountUSD, providerReference and paymentMethod are required',
      });
    }

    const amount = Number(amountUSD);
    if (Number.isNaN(amount) || amount <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'amountUSD must be a positive number' });
    }

    const normalizedIdentifier = String(userIdentifier).trim();
    const user = await User.findOne({
      $or: [
        { email: normalizedIdentifier.toLowerCase() },
        { userId: normalizedIdentifier },
      ],
    }).session(session);

    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: `No user found for: ${normalizedIdentifier}` });
    }

    const reference = String(providerReference).trim();
    const duplicate = await Transaction.findOne({ providerTransactionId: reference }).session(session);
    if (duplicate) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: `Reference ${reference} already exists in the system`,
      });
    }

    const wallet = await Wallet.findOneAndUpdate(
      { userId: user._id },
      {
        $inc: {
          balanceUSD: amount,
          totalDeposited: amount,
          totalEarned: amount,
        },
      },
      { session, new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const transaction = await Transaction.create(
      [{
        userId: user._id,
        type: 'manual_payment',
        status: 'successful',
        direction: 'credit',
        provider: 'manual',
        amountUSD: amount,
        amountLocal: Number(amountLocal) || amount,
        currency: currency || 'USD',
        country: country || user.country,
        providerTransactionId: reference,
        payoutStatus: 'executed',
        payoutExecutedAt: new Date(),
        payoutExecutedBy: req.user._id,
        processedAt: new Date(),
        metadata: {
          paymentMethod,
          note: note || '',
          recordedBy: req.user.userId || req.user.email,
          recordedByRole: req.user.role,
          walletSnapshot: {
            balanceBefore: Number(wallet.balanceUSD || 0) - amount,
            balanceAfter: Number(wallet.balanceUSD || 0),
          },
        },
      }],
      { session }
    );

    await session.commitTransaction();

    return res.json({
      success: true,
      message: `Manual payment of $${amount.toFixed(2)} recorded for ${user.email || user.userId}`,
      transaction: {
        id: transaction[0]._id,
        reference,
        amount,
        user: {
          id: user.userId,
          email: user.email,
          name: user.name,
        },
        newBalance: wallet.balanceUSD,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error(`manual-payment error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    session.endSession();
  }
});

// GET /api/admin/ledger/b2c-health
router.get('/ledger/b2c-health', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const last7days = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    pendingWithdrawals,
    todaySuccessful,
    todayFailed,
    stuckWithdrawals,
    weeklyVolume,
  ] = await Promise.all([
    Transaction.find({ type: 'withdrawal', status: 'pending' })
      .sort({ createdAt: 1 })
      .select('userId amountUSD amountLocal currency createdAt metadata'),

    Transaction.countDocuments({
      type: 'withdrawal', status: 'successful',
      processedAt: { $gte: todayStart },
    }),

    Transaction.countDocuments({
      type: 'withdrawal', status: 'failed',
      processedAt: { $gte: todayStart },
    }),

    Transaction.find({
      type: 'withdrawal', status: 'pending',
      createdAt: { $lt: new Date(now - 30 * 60 * 1000) }, // pending > 30 min
    }).select('userId amountUSD createdAt'),

    Transaction.aggregate([
      {
        $match: {
          type: 'withdrawal', status: 'successful',
          processedAt: { $gte: last7days },
        },
      },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$processedAt' } }, totalUSD: { $sum: '$amountUSD' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  res.json({
    success: true,
    b2c: {
      pendingCount: pendingWithdrawals.length,
      pendingWithdrawals,
      todaySuccessful,
      todayFailed,
      successRate: todaySuccessful + todayFailed > 0
        ? ((todaySuccessful / (todaySuccessful + todayFailed)) * 100).toFixed(1)
        : null,
      stuckWithdrawals,
      weeklyVolume,
    },
  });
});

router.post('/ledger/payouts/preview', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const { range = '30d' } = req.body;
  const ledger = await aggregateLedger(range);
  res.json({ success: true, preview: ledger });
});

router.post('/ledger/payouts/execute', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { range = '30d' } = req.body;
    const superadminId = req.user._id;

    // Get ledger totals
    const ledger = await aggregateLedger(range);
    const { totalUSD, superadminSharePercent, adminSharePercent } = ledger;

    if (totalUSD <= 0) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'No earnings to distribute' });
    }

    // Calculate shares
    const superadminShare = Number((totalUSD * superadminSharePercent / 100).toFixed(4));
    const adminTotalShare = Number((totalUSD * adminSharePercent / 100).toFixed(4));

    // Get all admins (excluding superadmin)
    const admins = await User.find({ role: 'admin' }, '_id userId', { session });
    const adminCount = Math.max(admins.length, 1);
    const sharePerAdmin = Number((adminTotalShare / adminCount).toFixed(4));

    // Credit superadmin wallet
    await Wallet.findOneAndUpdate(
      { userId: superadminId },
      { $inc: { balanceUSD: superadminShare, earnedUSD: superadminShare } },
      { session, new: true }
    );

    // Log superadmin transaction
    await Transaction.create(
      [{
        userId: superadminId,
        type: 'payout',
        status: 'successful',
        provider: 'internal_payout',
        amountUSD: superadminShare,
        amountLocal: 0,
        localCurrency: 'USD',
        description: `Payout (Superadmin) for ${range}`,
        payoutStatus: 'executed',
        payoutExecutedAt: new Date(),
        payoutExecutedBy: superadminId,
        metadata: {
          range,
          role: 'superadmin',
          sharePercent: superadminSharePercent,
        },
      }],
      { session }
    );

    // Credit admin wallets
    const adminPayouts = [];
    for (const admin of admins) {
      await Wallet.findOneAndUpdate(
        { userId: admin._id },
        { $inc: { balanceUSD: sharePerAdmin, earnedUSD: sharePerAdmin } },
        { session, new: true }
      );

      const transaction = await Transaction.create(
        [{
          userId: admin._id,
          type: 'payout',
          status: 'successful',
          provider: 'internal_payout',
          amountUSD: sharePerAdmin,
          amountLocal: 0,
          localCurrency: 'USD',
          description: `Payout (Admin) for ${range}`,
          payoutStatus: 'executed',
          payoutExecutedAt: new Date(),
          payoutExecutedBy: superadminId,
          metadata: {
            range,
            role: 'admin',
            sharePercent: adminSharePercent,
          },
        }],
        { session }
      );

      adminPayouts.push({
        adminId: admin._id,
        adminUserId: admin.userId,
        amount: sharePerAdmin,
        transactionId: transaction[0]._id,
      });
    }

    await session.commitTransaction();

    logger.info(`Payout executed: Superadmin $${superadminShare}, ${admins.length} admins $${sharePerAdmin} each`, {
      superadminId: superadminId.toString(),
      range,
    });

    res.json({
      success: true,
      message: 'Payout executed successfully',
      report: {
        totalDistributed: totalUSD,
        superadmin: {
          userId: superadminId,
          share: superadminSharePercent,
          amount: superadminShare,
        },
        admins: adminPayouts.map(p => ({
          userId: p.adminUserId,
          share: adminSharePercent,
          amount: p.amount,
        })),
        executedAt: new Date(),
      },
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Payout execution failed', { error: error.message, userId: req.user._id.toString() });
    res.status(500).json({ success: false, message: 'Payout execution failed', error: error.message });
  } finally {
    await session.endSession();
  }
});

router.get('/tasks', protect, requireAdmin, async (req, res) => {
  const tasks = await Challenge.find().sort({ createdAt: -1 });
  res.json({ success: true, tasks });
});

router.get('/challenges', protect, requireAdmin, async (req, res) => {
  try {
    const challenges = await Challenge.find().sort({ resetDaily: -1, sortOrder: 1, createdAt: -1 });
    res.json({ success: true, challenges });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/challenges', protect, requireAdmin, async (req, res) => {
  try {
    const payload = {
      ...req.body,
      isActive: req.body?.isActive !== false,
      isDaily: req.body?.isDaily !== false,
      resetDaily: req.body?.resetDaily !== false,
      expiresAt: req.body?.expiresAt || null,
    };
    const challenge = await Challenge.create(payload);
    res.status(201).json({ success: true, challenge });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.patch('/challenges/:id', protect, requireAdmin, async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.expiresAt === '') updates.expiresAt = null;
    const challenge = await Challenge.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }
    res.json({ success: true, challenge });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.delete('/challenges/:id', protect, requireAdmin, async (req, res) => {
  try {
    const challenge = await Challenge.findByIdAndDelete(req.params.id);
    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }
    res.json({ success: true, message: 'Challenge deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/provider-health', protect, requireAdmin, async (req, res) => {
  const providers = Object.entries(providerConfigs).map(([key, config]) => {
    const required = config.required.map(([name, value]) => ({ name, configured: truthy(value) }));
    const recommended = config.recommended.map(([name, value]) => ({ name, configured: truthy(value) }));
    const missingRequired = required.filter((item) => !item.configured).map((item) => item.name);

    return {
      key,
      label: config.label,
      environment: config.environment,
      documentationStatus: PROVIDER_STATUS[key] || 'internal',
      status: missingRequired.length === 0 ? (recommended.every((item) => item.configured) ? 'healthy' : 'partial') : 'missing_config',
      missingRequired,
      missingRecommended: recommended.filter((item) => !item.configured).map((item) => item.name),
      required,
      recommended,
      usage: {
        depositCountries: Object.entries(COUNTRIES)
          .filter(([, country]) => country.paymentRouting?.deposits?.some((strategy) => strategy.includes(key)))
          .map(([code]) => code),
        withdrawalCountries: Object.entries(COUNTRIES)
          .filter(([, country]) => country.paymentRouting?.withdrawals?.some((strategy) => strategy.includes(key)))
          .map(([code]) => code),
      },
    };
  });

  const transactionCounts = await Transaction.aggregate([
    {
      $group: {
        _id: '$provider',
        total: { $sum: 1 },
        successful: { $sum: { $cond: [{ $eq: ['$status', 'successful'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
      },
    },
  ]);

  const thresholdConfig = {
    invalidSignaturePerDay: Number(process.env.OFFERWALL_ALERT_INVALID_SIGNATURES_PER_DAY || 3),
    duplicatePerDay: Number(process.env.OFFERWALL_ALERT_DUPLICATES_PER_DAY || 10),
    invalidAmountPerDay: Number(process.env.OFFERWALL_ALERT_INVALID_AMOUNTS_PER_DAY || 3),
    failedPerDay: Number(process.env.OFFERWALL_ALERT_FAILED_PER_DAY || 8),
    suspiciousEventsPerDay: Number(process.env.OFFERWALL_ALERT_SUSPICIOUS_PER_DAY || 12),
  };

  const evaluateOfferwallRisk = (metrics) => {
    const reasons = [];
    const warningReasons = [];

    if (metrics.invalidSignature >= thresholdConfig.invalidSignaturePerDay) {
      reasons.push('invalid signatures above threshold');
    }
    if (metrics.duplicate >= thresholdConfig.duplicatePerDay) {
      reasons.push('duplicates above threshold');
    }
    if (metrics.invalidAmount >= thresholdConfig.invalidAmountPerDay) {
      reasons.push('invalid amounts above threshold');
    }
    if (metrics.failed >= thresholdConfig.failedPerDay) {
      reasons.push('callback failures above threshold');
    }
    if (metrics.suspiciousEvents >= thresholdConfig.suspiciousEventsPerDay) {
      reasons.push('suspicious event volume above threshold');
    }

    if (metrics.failed > 0) warningReasons.push('has callback failures');
    if (metrics.suspiciousEvents > 0) warningReasons.push('has suspicious callback events');

    if (reasons.length > 0) {
      return { riskLevel: 'critical', reasons };
    }
    if (warningReasons.length > 0) {
      return { riskLevel: 'warning', reasons: warningReasons };
    }

    return { riskLevel: 'clean', reasons: [] };
  };

  const offerwallPerformance = [];
  const metricsDay = new Date().toISOString().slice(0, 10);
  if (isRedisReady()) {
    try {
      const redis = getRedis();
      for (const providerKey of ['adgate', 'ayetstudios']) {
        const metricKeys = {
          processed: `metrics:offerwall:${providerKey}:${metricsDay}:processed`,
          credited: `metrics:offerwall:${providerKey}:${metricsDay}:credited`,
          duplicate: `metrics:offerwall:${providerKey}:${metricsDay}:duplicate`,
          invalidSignature: `metrics:offerwall:${providerKey}:${metricsDay}:invalid_signature`,
          invalidAmount: `metrics:offerwall:${providerKey}:${metricsDay}:invalid_amount`,
          failed: `metrics:offerwall:${providerKey}:${metricsDay}:failed`,
        };

        const [processed, credited, duplicate, invalidSignature, invalidAmount, failed] = await Promise.all([
          redis.get(metricKeys.processed),
          redis.get(metricKeys.credited),
          redis.get(metricKeys.duplicate),
          redis.get(metricKeys.invalidSignature),
          redis.get(metricKeys.invalidAmount),
          redis.get(metricKeys.failed),
        ]);

        const parsed = {
          processed: Number(processed || 0),
          credited: Number(credited || 0),
          duplicate: Number(duplicate || 0),
          invalidSignature: Number(invalidSignature || 0),
          invalidAmount: Number(invalidAmount || 0),
          failed: Number(failed || 0),
        };

        const suspiciousEvents = parsed.duplicate + parsed.invalidSignature + parsed.invalidAmount;
        const risk = evaluateOfferwallRisk({
          ...parsed,
          suspiciousEvents,
        });

        offerwallPerformance.push({
          provider: providerKey,
          day: metricsDay,
          ...parsed,
          suspiciousEvents,
          riskLevel: risk.riskLevel,
          triggerReasons: risk.reasons,
        });
      }
    } catch (error) {
      logger.warn(`Unable to load offerwall performance metrics: ${error.message}`);
    }
  }

  const adRewardSummary = await Transaction.aggregate([
    {
      $match: {
        type: 'offer',
        'metadata.provider': { $in: ['adgate', 'ayetstudios'] },
      },
    },
    {
      $group: {
        _id: '$metadata.provider',
        totalRewardsUSD: { $sum: '$amountUSD' },
        count: { $sum: 1 },
        latestRewardAt: { $max: '$createdAt' },
      },
    },
    { $sort: { totalRewardsUSD: -1 } },
  ]);

  res.json({
    success: true,
    generatedAt: new Date().toISOString(),
    stack: HYBRID_PAYMENT_STACK,
    providers,
    transactionCounts,
    adsMetrics: {
      day: metricsDay,
      thresholds: thresholdConfig,
      offerwallPerformance,
      adRewardSummary,
      source: isRedisReady() ? 'redis+mongodb' : 'mongodb',
    },
  });
});

router.get('/users/:id/ledger', protect, staffOnly, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  if (req.user.role === 'admin' && user.managedBy?.toString() !== req.user.id.toString() && user.role === 'user') {
    await User.findByIdAndUpdate(user._id, { managedBy: req.user.id, managedAt: new Date() });
  }

  const wallet = await Wallet.findOne({ userId: user._id });
  const transactions = await Transaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(100);

  res.json({
    success: true,
    user,
    wallet,
    transactions,
    managedBy: user.managedBy,
    managedAt: user.managedAt,
  });
});

router.post('/execute-payout', protect, ledgerOrSuperadminOnly, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { range = '30d' } = req.body;

    // Get ledger data
    const ledger = await aggregateLedger(range);
    
    if (ledger.totalUSD === 0 || ledger.count === 0) {
      await session.abortTransaction();
      return res.status(400).json({ 
        success: false, 
        message: 'No pending transactions to execute' 
      });
    }

    // Get superadmin wallet
    const superadminWallet = await Wallet.findOne({ userId: req.user._id }).session(session);
    if (!superadminWallet) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Superadmin wallet not found' });
    }

    // Calculate split
    const superadminSharePercent = getLedgerSplitPercent();
    const adminSharePercent = getAdminSharePercent();
    const superadminAmount = Number((ledger.totalUSD * superadminSharePercent / 100).toFixed(4));
    const adminAmount = Number((ledger.totalUSD * adminSharePercent / 100).toFixed(4));

    // Update superadmin wallet
    superadminWallet.balanceUSD += superadminAmount;
    superadminWallet.totalEarned += superadminAmount;
    await superadminWallet.save({ session });

    // Get all managed admins
    const admins = await User.find({
      role: 'admin',
      _id: { $ne: req.user._id }
    }).session(session);

    // Split admin amount equally among all admins
    const adminCount = admins.length || 1;
    const amountPerAdmin = Number((adminAmount / adminCount).toFixed(4));

    // Update admin wallets
    if (admins.length > 0) {
      for (const admin of admins) {
        const adminWallet = await Wallet.findOne({ userId: admin._id }).session(session);
        if (adminWallet) {
          adminWallet.balanceUSD += amountPerAdmin;
          adminWallet.totalEarned += amountPerAdmin;
          await adminWallet.save({ session });
        }
      }
    }

    // Mark all included transactions as paid out
    const transactionIds = ledger.transactions.map(tx => tx._id);
    await Transaction.updateMany(
      { _id: { $in: transactionIds } },
      { 
        $set: { 
          payoutStatus: 'executed',
          payoutExecutedAt: new Date(),
          payoutExecutedBy: req.user._id
        } 
      },
      { session }
    );

    await session.commitTransaction();

    // Log payout execution
    logger.info(`Payout executed: ${ledger.count} transactions, $${ledger.totalUSD.toFixed(2)} total`, {
      superadminAmount,
      adminAmount,
      adminCount,
      amountPerAdmin,
      userId: req.user._id
    });

    res.json({
      success: true,
      message: 'Payout executed successfully',
      execution: {
        totalTransactions: ledger.count,
        totalAmount: ledger.totalUSD,
        superadminAmount,
        adminAmount,
        adminsCount: admins.length,
        amountPerAdmin,
        executedAt: new Date(),
      },
    });
  } catch (error) {
    await session.abortTransaction();
    logger.error('Payout execution failed:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to execute payout: ' + error.message 
    });
  } finally {
    await session.endSession();
  }
});

module.exports = router;
