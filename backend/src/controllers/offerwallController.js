const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { getRedis, isRedisReady } = require('../config/redis');
const logger = require('../utils/logger');
const { trackEvent, checkEarningMilestones } = require('../services/eventTracker');
const crypto = require('crypto');
const {
  OFFERWALL_PROVIDER_KEYS,
  getOfferwallContext,
  getOfferwallProvider,
} = require('../utils/offerwallLaunch');

const OFFERWALL_SESSION_TTL_SECONDS = 60 * 60 * 12;

const OFFER_REWARD_CAP_USD = 50;

const getOrCreateWallet = async (user) => {
  let wallet = await Wallet.findOne({ userId: user._id });
  if (!wallet) {
    wallet = await Wallet.create({ userId: user._id });
  }
  return wallet;
};

const toOfferRewardUSD = (value, inCents = false) => {
  const raw = Number.parseFloat(value);
  if (!Number.isFinite(raw) || raw <= 0) return null;

  const amount = inCents ? raw / 100 : raw;
  return Math.min(Number(amount.toFixed(4)), OFFER_REWARD_CAP_USD);
};

const isDuplicateOfferReward = async (provider, providerTransactionId) => {
  if (!providerTransactionId) return false;

  const existing = await Transaction.findOne({
    type: 'offer',
    providerTransactionId,
    'metadata.provider': provider,
    status: 'successful',
  }).lean();

  return Boolean(existing);
};

const trackOfferwallMetric = async (provider, metric) => {
  if (!isRedisReady()) return;

  try {
    const redis = getRedis();
    const day = new Date().toISOString().slice(0, 10);
    const key = `metrics:offerwall:${provider}:${day}:${metric}`;
    await redis.incr(key);
    await redis.expire(key, 86400 * 45);
  } catch (error) {
    logger.warn(`Offerwall metric track failed: ${error.message}`);
  }
};

const createOfferwallSession = async ({ user, providerKey }) => {
  const sessionId = `OW-${providerKey}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const payload = {
    sessionId,
    userId: user._id.toString(),
    userCode: user.userId,
    providerKey,
    createdAt: new Date().toISOString(),
  };

  if (isRedisReady()) {
    try {
      await getRedis().setex(`offerwall:session:${sessionId}`, OFFERWALL_SESSION_TTL_SECONDS, JSON.stringify(payload));
    } catch (error) {
      logger.warn(`Offerwall session store failed: ${error.message}`);
    }
  }

  return payload;
};

// @GET /api/offerwalls/ayetstudios
exports.getAyetStudiosWall = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.activationStatus) {
      return res.status(403).json({ success: false, message: 'Activation required' });
    }

    const pubId = process.env.AYETSTUDIOS_PUB_ID;
    const apiKey = process.env.AYETSTUDIOS_API_KEY;
    const userId = user.userId;
    const placement = 'rewarded_offerwall';

    // Ayет Studios secure hash: sha256(pub_id + user_id + api_key)
    const hash = crypto.createHash('sha256').update(`${pubId}${userId}${apiKey}`).digest('hex');
    const wallUrl = `https://www.ayetstudios.com/offers/web_offerwall/${pubId}?external_identifier=${userId}&placement=${placement}&sign=${hash}`;

    res.json({ success: true, wallUrl });
  } catch (error) {
    logger.error(`getAyetStudiosWall error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/offerwalls/adgate
exports.getAdGateWall = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.activationStatus) {
      return res.status(403).json({ success: false, message: 'Activation required' });
    }

    const pubId = process.env.ADGATE_PUBLISHER_ID;
    const userId = user.userId;

    const wallUrl = `https://wall.adgaterewards.com/${pubId}/${userId}`;
    res.json({ success: true, wallUrl });
  } catch (error) {
    logger.error(`getAdGateWall error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/offerwalls/launch/:providerKey
exports.launchOfferwall = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { providerKey } = req.params;
    if (!OFFERWALL_PROVIDER_KEYS.has(providerKey)) {
      return res.status(400).json({ success: false, message: 'Invalid offerwall provider' });
    }

    const session = await createOfferwallSession({ user, providerKey });
    const context = getOfferwallContext({ req, user, sessionId: session.sessionId });
    const provider = getOfferwallProvider(providerKey, context);

    if (!provider?.url) {
      return res.status(503).json({ success: false, message: 'Provider is not configured yet' });
    }

    res.json({
      success: true,
      sessionId: session.sessionId,
      provider,
      wallUrl: provider.url,
    });
  } catch (error) {
    logger.error(`launchOfferwall error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/offerwalls/history
exports.getOfferwallHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const skip = (pageNumber - 1) * pageSize;

    const query = {
      userId: req.user.id,
      type: 'offer',
      'metadata.provider': { $in: ['adgate', 'ayetstudios', 'cpa', 'timewall'] },
    };

    const [transactions, total] = await Promise.all([
      Transaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
      Transaction.countDocuments(query),
    ]);

    res.json({
      success: true,
      transactions,
      pagination: {
        total,
        page: pageNumber,
        pages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    logger.error(`getOfferwallHistory error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/offerwalls/ayetstudios/callback
exports.ayetStudiosCallback = async (req, res) => {
  try {
    const { external_identifier, payout, transaction_id, sign } = req.query;

    // Verify signature
    const expectedSign = crypto
      .createHash('sha256')
      .update(`${external_identifier}${payout}${transaction_id}${process.env.AYETSTUDIOS_API_KEY}`)
      .digest('hex');

    if (sign !== expectedSign) {
      logger.warn(`Ayет Studios signature mismatch: ${transaction_id}`);
      await trackOfferwallMetric('ayetstudios', 'invalid_signature');
      return res.status(401).send('INVALID_SIGN');
    }

    if (await isDuplicateOfferReward('ayetstudios', transaction_id)) {
      await trackOfferwallMetric('ayetstudios', 'duplicate');
      return res.send('OK');
    }

    if (isRedisReady()) {
      try {
        const redis = getRedis();
        const dupKey = `ayet:tx:${transaction_id}`;
        if (await redis.get(dupKey)) return res.send('OK');
        await redis.setex(dupKey, 86400 * 7, '1');
      } catch (error) {
        logger.warn(`Ayet Redis dedupe failed: ${error.message}`);
      }
    }

    const user = await User.findOne({ userId: external_identifier });
    if (!user) return res.status(404).send('USER_NOT_FOUND');

    const amountUSD = toOfferRewardUSD(payout, true);
    if (!amountUSD) {
      await trackOfferwallMetric('ayetstudios', 'invalid_amount');
      return res.status(400).send('INVALID_AMOUNT');
    }

    const wallet = await getOrCreateWallet(user);
    await wallet.credit(amountUSD, 'offer');
    await trackOfferwallMetric('ayetstudios', 'credited');

    await Transaction.create({
      userId: user._id,
      type: 'offer',
      amountLocal: amountUSD,
      amountUSD,
      currency: 'USD',
      country: user.country,
      provider: 'internal',
      direction: 'credit',
      status: 'successful',
      providerTransactionId: transaction_id,
      processedAt: new Date(),
      metadata: { provider: 'ayetstudios' },
    });

    await User.findByIdAndUpdate(user._id, { $inc: { xpPoints: 30 } });
    await trackEvent(user._id, 'offerwall_complete');
    await checkEarningMilestones(user._id);

    logger.info(`Ayет Studios offer reward: $${amountUSD} for ${external_identifier}`);
    await trackOfferwallMetric('ayetstudios', 'processed');
    res.send('OK');
  } catch (error) {
    logger.error(`ayetStudiosCallback error: ${error.message}`);
    await trackOfferwallMetric('ayetstudios', 'failed');
    res.status(500).send('ERROR');
  }
};

// @GET /api/offerwalls/adgate/callback
exports.adGateCallback = async (req, res) => {
  try {
    const { user_id, payout, transaction_id, hash } = req.query;

    const expectedHash = crypto
      .createHash('md5')
      .update(`${user_id}:${payout}:${process.env.ADGATE_PUBLISHER_ID}`)
      .digest('hex');

    if (hash !== expectedHash) {
      await trackOfferwallMetric('adgate', 'invalid_signature');
      return res.status(401).send('INVALID');
    }

    if (await isDuplicateOfferReward('adgate', transaction_id)) {
      await trackOfferwallMetric('adgate', 'duplicate');
      return res.send('1');
    }

    if (isRedisReady()) {
      try {
        const redis = getRedis();
        const dupKey = `adgate:tx:${transaction_id}`;
        if (await redis.get(dupKey)) return res.send('1');
        await redis.setex(dupKey, 86400 * 7, '1');
      } catch (error) {
        logger.warn(`AdGate Redis dedupe failed: ${error.message}`);
      }
    }

    const user = await User.findOne({ userId: user_id });
    if (!user) return res.status(404).send('0');

    const amountUSD = toOfferRewardUSD(payout);
    if (!amountUSD) {
      await trackOfferwallMetric('adgate', 'invalid_amount');
      return res.status(400).send('0');
    }

    const wallet = await getOrCreateWallet(user);
    await wallet.credit(amountUSD, 'offer');
    await trackOfferwallMetric('adgate', 'credited');

    await Transaction.create({
      userId: user._id,
      type: 'offer',
      amountLocal: amountUSD,
      amountUSD,
      currency: 'USD',
      country: user.country,
      provider: 'internal',
      direction: 'credit',
      status: 'successful',
      providerTransactionId: transaction_id,
      processedAt: new Date(),
      metadata: { provider: 'adgate' },
    });

    await User.findByIdAndUpdate(user._id, { $inc: { xpPoints: 30 } });
    await trackEvent(user._id, 'offerwall_complete');
    await checkEarningMilestones(user._id);
    await trackOfferwallMetric('adgate', 'processed');
    res.send('1');
  } catch (error) {
    logger.error(`adGateCallback error: ${error.message}`);
    await trackOfferwallMetric('adgate', 'failed');
    res.send('0');
  }
};
