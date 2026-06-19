const crypto = require('crypto');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const logger = require('../utils/logger');
const { trackEvent, checkEarningMilestones } = require('../services/eventTracker');

const REWARD_CAP_USD = 50;
const ADGEM_POSTBACK_KEY = process.env.ADGEM_POSTBACK_KEY || '';

const verifyAdGemRequest = (requestId, verifier) => {
  if (!ADGEM_POSTBACK_KEY || !requestId || !verifier) return false;

  const expected = crypto
    .createHash('sha256')
    .update(`${requestId}${ADGEM_POSTBACK_KEY}`)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(String(verifier), 'hex'));
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

// @GET /api/adgem/postback
exports.postback = async (req, res) => {
  const respond = (message = 'OK') => res.status(200).send(message);

  try {
    const {
      request_id,
      verifier,
      player_id,
      transaction_id,
      amount,
      payout,
      offer_id,
      offer_name,
      country,
    } = req.query;

    if (!request_id || !verifier) {
      logger.warn(`[AdGem] Missing request_id/verifier: ${JSON.stringify(req.query)}`);
      return respond('MISSING_PARAMS');
    }

    if (!verifyAdGemRequest(request_id, verifier)) {
      logger.warn(`[AdGem] Verifier mismatch request_id=${request_id}`);
      return respond('INVALID_VERIFIER');
    }

    if (!player_id || !transaction_id || !amount) {
      logger.warn(`[AdGem] Missing player_id/transaction_id/amount: ${JSON.stringify(req.query)}`);
      return respond('MISSING_PARAMS');
    }

    const user = await User.findById(player_id);
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

    const parsedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      logger.warn(`[AdGem] Invalid amount: ${amount}`);
      return respond('INVALID_AMOUNT');
    }

    const creditAmount = Math.min(parsedAmount, REWARD_CAP_USD);
    const wallet = await getWallet(user._id);
    await wallet.credit(creditAmount, 'offer');

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
        rawPayout: payout,
      },
    });

    await trackEvent(user._id, 'offerwall_complete').catch(() => {});
    await checkEarningMilestones(user._id).catch(() => {});

    logger.info(`[AdGem] Credited user=${player_id} amount=${creditAmount} txn=${transaction_id}`);
    return respond('OK');
  } catch (error) {
    logger.error(`[AdGem] postback error: ${error.message}`);
    return respond('OK');
  }
};
