const crypto = require('crypto');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

// @GET /api/surveys/cpx
// Returns CPX Research offerwall URL for the user
exports.getCPXSurveyWall = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.activationStatus) {
      return res.status(403).json({ success: false, message: 'Account activation required' });
    }

    const appId = process.env.CPX_RESEARCH_APP_ID;
    const hashKey = process.env.CPX_RESEARCH_HASH_KEY;
    const userId = user.userId;

    // CPX requires a secure hash: md5(user_id + "-" + hash_key)
    const hash = crypto.createHash('md5').update(`${userId}-${hashKey}`).digest('hex');

    const wallUrl = `https://offers.cpx-research.com/index.php?app_id=${appId}&ext_user_id=${userId}&secure_hash=${hash}&username=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email || '')}&subid_1=${user.country}`;

    res.json({ success: true, wallUrl });
  } catch (error) {
    logger.error(`getCPXSurveyWall error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/surveys/bitlabs
exports.getBitLabsWall = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.activationStatus) {
      return res.status(403).json({ success: false, message: 'Account activation required' });
    }

    const token = process.env.BITLABS_API_TOKEN;
    const userId = user.userId;

    // BitLabs offerwall link
    const wallUrl = `https://web.bitlabs.ai/?token=${token}&uid=${userId}`;

    res.json({ success: true, wallUrl });
  } catch (error) {
    logger.error(`getBitLabsWall error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/surveys/cpx/callback
// CPX postback when user completes a survey
exports.cpxCallback = async (req, res) => {
  try {
    const { user_id, amount_local, trans_id, hash } = req.query;

    // Verify hash
    const expected = crypto
      .createHash('md5')
      .update(`${user_id}${process.env.CPX_RESEARCH_HASH_KEY}`)
      .digest('hex');

    if (hash !== expected) {
      logger.warn(`CPX callback hash mismatch for user ${user_id}`);
      return res.status(401).send('1'); // CPX expects '1' on error
    }

    // Prevent duplicate processing
    const redis = getRedis();
    const dupKey = `cpx:tx:${trans_id}`;
    const isDup = await redis.get(dupKey);
    if (isDup) return res.send('1');
    await redis.setex(dupKey, 86400, '1');

    const user = await User.findOne({ userId: user_id });
    if (!user) return res.send('1');

    const amountUSD = parseFloat(amount_local);
    if (isNaN(amountUSD) || amountUSD <= 0) return res.send('1');

    // Credit wallet
    const wallet = await Wallet.findOne({ userId: user._id });
    await wallet.credit(amountUSD, 'survey');

    // Log transaction
    await Transaction.create({
      userId: user._id,
      type: 'survey',
      amountLocal: amountUSD,
      amountUSD,
      currency: 'USD',
      country: user.country,
      provider: 'internal',
      direction: 'credit',
      status: 'successful',
      providerTransactionId: trans_id,
      processedAt: new Date(),
      metadata: { provider: 'cpx_research' },
    });

    // XP reward
    await User.findByIdAndUpdate(user._id, { $inc: { xpPoints: 20, surveysCompleted: 1 } });

    logger.info(`CPX survey reward: $${amountUSD} for user ${user_id}`);
    res.send('1'); // CPX expects '1' on success
  } catch (error) {
    logger.error(`cpxCallback error: ${error.message}`);
    res.send('1');
  }
};

// @POST /api/surveys/bitlabs/callback
exports.bitlabsCallback = async (req, res) => {
  try {
    const { uid, reward, transaction_id } = req.body;

    const redis = getRedis();
    const dupKey = `bitlabs:tx:${transaction_id}`;
    const isDup = await redis.get(dupKey);
    if (isDup) return res.json({ success: true });
    await redis.setex(dupKey, 86400, '1');

    const user = await User.findOne({ userId: uid });
    if (!user) return res.status(404).json({ success: false });

    const amountUSD = parseFloat(reward);
    const wallet = await Wallet.findOne({ userId: user._id });
    await wallet.credit(amountUSD, 'survey');

    await Transaction.create({
      userId: user._id,
      type: 'survey',
      amountLocal: amountUSD,
      amountUSD,
      currency: 'USD',
      country: user.country,
      provider: 'internal',
      direction: 'credit',
      status: 'successful',
      providerTransactionId: transaction_id,
      processedAt: new Date(),
      metadata: { provider: 'bitlabs' },
    });

    await User.findByIdAndUpdate(user._id, { $inc: { xpPoints: 20, surveysCompleted: 1 } });

    logger.info(`BitLabs reward: $${amountUSD} for user ${uid}`);
    res.json({ success: true });
  } catch (error) {
    logger.error(`bitlabsCallback error: ${error.message}`);
    res.status(500).json({ success: false });
  }
};

// @GET /api/surveys/history
exports.getSurveyHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({
      userId: req.user.id,
      type: 'survey',
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    res.json({ success: true, transactions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
