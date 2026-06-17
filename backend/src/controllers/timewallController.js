const crypto = require('crypto');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');
const { trackEvent, checkEarningMilestones } = require('../services/eventTracker');

const TIMEWALL_IPS = new Set(['51.81.120.73', '142.111.248.18']);
const REWARD_CAP_USD = 50;

const TIMEWALL_SECRETS = {
  offerwalls: process.env.TIMEWALL_SECRET_OFFERWALLS || process.env.TIMEWALL_SECRET_KEY || '',
  challenges: process.env.TIMEWALL_SECRET_CHALLENGES || process.env.TIMEWALL_SECRET_KEY || '',
  referrals: process.env.TIMEWALL_SECRET_REFERRALS || process.env.TIMEWALL_SECRET_KEY || '',
};

const getClientIp = (req) => {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwardedFor || req.ip || req.connection?.remoteAddress || '';
};

const normalizeIp = (value) => String(value || '').replace('::ffff:', '').trim();

const verifyHash = (userId, revenue, hash, placement) => {
  const secret = TIMEWALL_SECRETS[placement];
  if (!secret || !hash) return false;

  const expected = crypto.createHash('sha256').update(`${userId}${revenue}${secret}`).digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(String(hash), 'hex'));
  } catch {
    return false;
  }
};

const getWallet = async (userId) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({ userId });
  }
  return wallet;
};

const createTransaction = async (payload) => {
  await Transaction.create({
    type: 'offer',
    amountLocal: 0,
    amountUSD: 0,
    currency: 'USD',
    country: payload.country,
    provider: 'internal',
    direction: payload.direction,
    status: payload.status,
    ...payload,
  });
};

// @GET /api/timewall/postback
exports.postback = async (req, res) => {
  const respond = (message = 'OK') => res.status(200).send(message);

  try {
    const {
      user_id,
      txn_id,
      revenue,
      currency_amount,
      type = 'credit',
      hash,
      placement,
    } = req.query;

    const normalizedPlacement = String(placement || '').trim().toLowerCase();
    const normalizedIp = normalizeIp(getClientIp(req));

    if (!TIMEWALL_IPS.has(normalizedIp)) {
      logger.warn(`[Timewall] Blocked request from unknown IP: ${normalizedIp || 'unknown'}`);
      return respond('BLOCKED');
    }

    if (!['offerwalls', 'challenges', 'referrals'].includes(normalizedPlacement)) {
      logger.warn(`[Timewall] Invalid placement: ${normalizedPlacement || 'missing'}`);
      return respond('INVALID_PLACEMENT');
    }

    if (!user_id || !txn_id || !revenue || !hash) {
      logger.warn(`[Timewall] Missing required params: ${JSON.stringify(req.query)}`);
      return respond('MISSING_PARAMS');
    }

    if (!verifyHash(user_id, revenue, hash, normalizedPlacement)) {
      logger.warn(`[Timewall] Hash verification failed for txn=${txn_id}`);
      return respond('INVALID_HASH');
    }

    const user = await User.findById(user_id);
    if (!user) {
      logger.warn(`[Timewall] User not found: ${user_id}`);
      return respond('USER_NOT_FOUND');
    }

    const parsedRevenue = Number.parseFloat(revenue);
    const parsedCurrencyAmount = Number.parseFloat(currency_amount);
    const existingTx = await Transaction.findOne({
      providerTransactionId: txn_id,
      'metadata.provider': 'timewall',
    }).sort({ createdAt: -1 });

    if (type === 'hold') {
      if (existingTx?.status === 'successful' || existingTx?.status === 'reversed') {
        logger.warn(`[Timewall] Hold ignored for completed txn=${txn_id}`);
        return respond('DUPLICATE');
      }

      const pendingPayload = {
        userId: user._id,
        type: normalizedPlacement === 'challenges' ? 'challenge' : 'offer',
        amountLocal: 0,
        amountUSD: 0,
        currency: 'USD',
        country: user.country,
        provider: 'internal',
        direction: 'credit',
        status: 'pending',
        providerTransactionId: txn_id,
        metadata: {
          provider: 'timewall',
          placement: normalizedPlacement,
          type: 'hold',
        },
      };

      if (existingTx?.status === 'pending') {
        existingTx.set(pendingPayload);
        await existingTx.save();
      } else {
        await Transaction.create(pendingPayload);
      }

      logger.info(`[Timewall] Hold recorded txn=${txn_id} placement=${normalizedPlacement}`);
      return respond('OK');
    }

    if (type === 'hold_cancelled') {
      await Transaction.findOneAndDelete({
        providerTransactionId: txn_id,
        'metadata.provider': 'timewall',
        status: 'pending',
      });

      logger.info(`[Timewall] Hold cancelled txn=${txn_id} placement=${normalizedPlacement}`);
      return respond('OK');
    }

    if (type === 'chargeback') {
      if (existingTx?.status === 'reversed') {
        logger.warn(`[Timewall] Duplicate chargeback blocked txn=${txn_id}`);
        return respond('DUPLICATE');
      }

      if (normalizedPlacement === 'challenges') {
        const xpToDeduct = Math.max(Math.floor(Math.abs(parsedCurrencyAmount || 0)), 0);
        if (xpToDeduct > 0) {
          user.xpPoints = Math.max((user.xpPoints || 0) - xpToDeduct, 0);
          user.checkLevelUp();
          await user.save();
        }

        await createTransaction({
          userId: user._id,
          user,
          type: 'challenge',
          amountLocal: Math.max(parsedRevenue, 0),
          amountUSD: Math.max(parsedRevenue, 0),
          currency: 'USD',
          country: user.country,
          providerTransactionId: txn_id,
          direction: 'debit',
          status: 'reversed',
          processedAt: new Date(),
          metadata: {
            provider: 'timewall',
            placement: normalizedPlacement,
            type: 'chargeback',
            xpDeducted: xpToDeduct,
            rawRevenue: parsedRevenue,
          },
        });

        logger.info(`[Timewall] XP chargeback applied user=${user_id} xp=${xpToDeduct} txn=${txn_id}`);
        return respond('OK');
      }

      const deductAmount = Math.min(Math.abs(parsedRevenue || 0), REWARD_CAP_USD);
      const wallet = await getWallet(user._id);
      wallet.balanceUSD = Math.max((wallet.balanceUSD || 0) - deductAmount, 0);
      wallet.totalEarned = Math.max((wallet.totalEarned || 0) - deductAmount, 0);

      if (normalizedPlacement === 'offerwalls' || normalizedPlacement === 'referrals') {
        wallet.offerEarnings = Math.max((wallet.offerEarnings || 0) - deductAmount, 0);
      }

      await wallet.save();

      await createTransaction({
        userId: user._id,
        user,
        type: 'offer',
        amountLocal: deductAmount,
        amountUSD: deductAmount,
        currency: 'USD',
        country: user.country,
        providerTransactionId: txn_id,
        direction: 'debit',
        status: 'reversed',
        processedAt: new Date(),
        metadata: {
          provider: 'timewall',
          placement: normalizedPlacement,
          type: 'chargeback',
          rawRevenue: parsedRevenue,
        },
      });

      logger.info(`[Timewall] Chargeback applied user=${user_id} amount=${deductAmount} txn=${txn_id}`);
      return respond('OK');
    }

    if (existingTx?.status === 'successful' || existingTx?.status === 'reversed') {
      logger.warn(`[Timewall] Duplicate blocked txn=${txn_id}`);
      return respond('DUPLICATE');
    }

    if (normalizedPlacement === 'challenges') {
      const xpToAward = Math.max(Math.floor(Math.abs(parsedCurrencyAmount || 0)), 0);
      if (xpToAward <= 0) {
        logger.warn(`[Timewall] Invalid XP amount: ${currency_amount}`);
        return respond('INVALID_AMOUNT');
      }

      user.xpPoints = (user.xpPoints || 0) + xpToAward;
      user.checkLevelUp();
      await user.save();

      const txPayload = {
        userId: user._id,
        type: 'challenge',
        amountLocal: Math.max(parsedRevenue, 0),
        amountUSD: Math.max(parsedRevenue, 0),
        currency: 'USD',
        country: user.country,
        providerTransactionId: txn_id,
        direction: 'credit',
        status: 'successful',
        processedAt: new Date(),
        metadata: {
          provider: 'timewall',
          placement: normalizedPlacement,
          type: 'credit',
          xpAwarded: xpToAward,
          rawRevenue: parsedRevenue,
        },
      };

      if (existingTx?.status === 'pending') {
        existingTx.set(txPayload);
        await existingTx.save();
      } else {
        await createTransaction(txPayload);
      }

      await trackEvent(user._id, 'challenge_complete').catch(() => {});
      await checkEarningMilestones(user._id).catch(() => {});

      logger.info(`[Timewall] Awarded ${xpToAward} XP to user=${user_id} txn=${txn_id}`);
      return respond('OK');
    }

    if (!Number.isFinite(parsedRevenue) || parsedRevenue <= 0) {
      logger.warn(`[Timewall] Invalid revenue amount: ${revenue}`);
      return respond('INVALID_AMOUNT');
    }

    const creditAmount = Math.min(parsedRevenue, REWARD_CAP_USD);
    const wallet = await getWallet(user._id);
    await wallet.credit(creditAmount, 'offer');

    const txPayload = {
      userId: user._id,
      type: 'offer',
      amountLocal: creditAmount,
      amountUSD: creditAmount,
      currency: 'USD',
      country: user.country,
      providerTransactionId: txn_id,
      direction: 'credit',
      status: 'successful',
      processedAt: new Date(),
      metadata: {
        provider: 'timewall',
        placement: normalizedPlacement,
        type: 'credit',
        rawRevenue: parsedRevenue,
      },
    };

    if (existingTx?.status === 'pending') {
      existingTx.set(txPayload);
      await existingTx.save();
    } else {
      await createTransaction(txPayload);
    }

    if (normalizedPlacement === 'referrals') {
      await trackEvent(user._id, 'referral').catch(() => {});
    } else {
      await trackEvent(user._id, 'offerwall_complete').catch(() => {});
    }
    await checkEarningMilestones(user._id).catch(() => {});

    logger.info(`[Timewall] Credited user=${user_id} amount=${creditAmount} placement=${normalizedPlacement} txn=${txn_id}`);
    return respond('OK');
  } catch (error) {
    logger.error(`[Timewall] postback error: ${error.message}`);
    return respond('OK');
  }
};
