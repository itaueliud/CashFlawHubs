const crypto = require('crypto');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');
const { trackEvent, checkEarningMilestones } = require('../services/eventTracker');

const REWARD_CAP_USD = 50;
const ADGEM_POSTBACK_KEY = process.env.ADGEM_POSTBACK_KEY || '';

const verifyAdGemRequest = (req) => {
  if (!ADGEM_POSTBACK_KEY) return false;

  const verifier = req.query.verifier;
  if (!verifier) return false;

  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  if (!host) return false;

  const fullUrl = new URL(`${protocol}://${host}${req.originalUrl}`);
  fullUrl.searchParams.delete('verifier');

  const expected = crypto
    .createHmac('sha256', ADGEM_POSTBACK_KEY)
    .update(fullUrl.toString())
    .digest('hex');

  const matched = (() => {
    try {
      return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(String(verifier), 'hex'));
    } catch {
      return false;
    }
  })();

  if (!matched) {
    logger.warn(
      `[AdGem] Verifier mismatch debug — hashedUrl="${fullUrl.toString()}" expected="${expected}" received="${verifier}"`
    );
  }

  return matched;
};

const getWallet = async (userId) => {
  let wallet = await Wallet.findOne({ userId });
  if (!wallet) {
    wallet = await Wallet.create({ userId });
  }
  return wallet;
};

// @GET /api/adgem/postback
exports.postback = async (req, res) => {
  const respond = (message = 'OK') => res.status(200).send(message);

  try {
    const {
      request_id,
      player_id,
      transaction_id,
      payout,
      amount,
      offer_id,
      offer_name,
      country,
    } = req.query;

    if (!request_id || !req.query.verifier) {
      logger.warn(`[AdGem] Missing request_id/verifier: ${JSON.stringify(req.query)}`);
      return respond('MISSING_PARAMS');
    }

    if (!verifyAdGemRequest(req)) {
      logger.warn(`[AdGem] Verifier mismatch request_id=${request_id}`);
      return respond('INVALID_VERIFIER');
    }

    if (!player_id || !transaction_id || !payout) {
      logger.warn(`[AdGem] Missing player_id/transaction_id/payout: ${JSON.stringify(req.query)}`);
      return respond('MISSING_PARAMS');
    }

    const user = await User.findOne({ userId: player_id });
    if (!user) {
      logger.warn(`[AdGem] User not found: ${player_id}`);
      return respond('USER_NOT_FOUND');
    }

    const existingTx = await Transaction.findOne({
      providerTransactionId: transaction_id,
      'metadata.provider': 'adgem',
    });

    if (existingTx) {
      logger.warn(`[AdGem] Duplicate postback blocked txn=${transaction_id}`);
      return respond('DUPLICATE');
    }

    const parsedAmount = Number.parseFloat(payout);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      logger.warn(`[AdGem] Invalid payout amount: ${payout}`);
      return respond('INVALID_AMOUNT');
    }

    const creditAmount = Math.min(parsedAmount, REWARD_CAP_USD);
    const xpAwarded = Math.max(Math.round(creditAmount), 0);

    await Transaction.create({
      userId: user._id,
      type: 'offer',
      amountLocal: creditAmount,
      amountUSD: creditAmount,
      currency: 'USD',
      country: country || user.country,
      provider: 'internal',
      direction: 'credit',
      status: 'successful',
      providerTransactionId: transaction_id,
      processedAt: new Date(),
      metadata: {
        provider: 'adgem',
        placement: 'offerwalls',
        offerId: offer_id,
        offerName: offer_name,
        requestId: request_id,
        rawAmount: amount,
        xpAwarded,
      },
    });

    await User.findByIdAndUpdate(user._id, { $inc: { xpPoints: xpAwarded } });

    await trackEvent(user._id, 'offerwall_complete').catch(() => {});
    await checkEarningMilestones(user._id).catch(() => {});

    logger.info(`[AdGem] Credited user=${player_id} amount=${creditAmount} txn=${transaction_id}`);
    return respond('OK');
  } catch (error) {
    logger.error(`[AdGem] postback error: ${error.message}`);
    return respond('OK');
  }
};
