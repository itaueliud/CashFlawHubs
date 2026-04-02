const crypto = require('crypto');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

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
    const hash = crypto
      .createHash('sha256')
      .update(`${pubId}${userId}${apiKey}`)
      .digest('hex');

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
    if (!user.activationStatus) {
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
      return res.status(401).send('INVALID_SIGN');
    }

    // Dedup
    const redis = getRedis();
    const dupKey = `ayet:tx:${transaction_id}`;
    if (await redis.get(dupKey)) return res.send('OK');
    await redis.setex(dupKey, 86400 * 7, '1');

    const user = await User.findOne({ userId: external_identifier });
    if (!user) return res.status(404).send('USER_NOT_FOUND');

    const amountUSD = parseFloat(payout) / 100; // Ayет sends in cents

    const wallet = await Wallet.findOne({ userId: user._id });
    await wallet.credit(amountUSD, 'offer');

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

    logger.info(`Ayет Studios offer reward: $${amountUSD} for ${external_identifier}`);
    res.send('OK');
  } catch (error) {
    logger.error(`ayetStudiosCallback error: ${error.message}`);
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

    if (hash !== expectedHash) return res.status(401).send('INVALID');

    const redis = getRedis();
    const dupKey = `adgate:tx:${transaction_id}`;
    if (await redis.get(dupKey)) return res.send('1');
    await redis.setex(dupKey, 86400 * 7, '1');

    const user = await User.findOne({ userId: user_id });
    if (!user) return res.status(404).send('0');

    const amountUSD = parseFloat(payout);
    const wallet = await Wallet.findOne({ userId: user._id });
    await wallet.credit(amountUSD, 'offer');

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
    res.send('1');
  } catch (error) {
    logger.error(`adGateCallback error: ${error.message}`);
    res.send('0');
  }
};
