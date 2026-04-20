const express = require('express');
const router = express.Router();
const { protect, adminOnly } = require('../middleware/auth');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { COUNTRIES } = require('../config/countries');
const { HYBRID_PAYMENT_STACK, PROVIDER_STATUS } = require('../config/paymentStack');

const truthy = (value) => Boolean(value && String(value).trim());

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

router.get('/stats', protect, adminOnly, async (req, res) => {
  const [totalUsers, activeUsers, totalTransactions] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ activationStatus: true }),
    Transaction.countDocuments({ status: 'successful' }),
  ]);
  res.json({ success: true, stats: { totalUsers, activeUsers, totalTransactions } });
});

router.get('/users', protect, adminOnly, async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const users = await User.find().sort({ createdAt: -1 }).skip((page-1)*limit).limit(Number(limit));
  res.json({ success: true, users });
});

router.put('/users/:id/ban', protect, adminOnly, async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isBanned: true, banReason: req.body.reason }, { new: true });
  res.json({ success: true, user });
});

router.get('/tasks', protect, adminOnly, async (req, res) => {
  const tasks = await require('../models/Challenge').Challenge.find().sort({ createdAt: -1 });
  res.json({ success: true, tasks });
});

router.get('/provider-health', protect, adminOnly, async (req, res) => {
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

  res.json({
    success: true,
    generatedAt: new Date().toISOString(),
    stack: HYBRID_PAYMENT_STACK,
    providers,
    transactionCounts,
  });
});

module.exports = router;
