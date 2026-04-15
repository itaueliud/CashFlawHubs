const crypto = require('crypto');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');
const { updateChallengeProgress } = require('./challengeController');
const { getCategoryProviders } = require('../config/categoryProviders');

const SURVEY_TEMPLATE = [
  {
    id: 'mobile-phone-usage',
    title: 'Mobile Phone Usage Survey',
    description: 'Answer a short consumer survey about daily mobile habits and app usage.',
    estimatedMinutes: 7,
    rewardUSD: 0.8,
    providerKey: 'cpx',
    countryNote: 'Available for active users in supported African countries.',
  },
  {
    id: 'shopping-habits',
    title: 'Shopping Habits Survey',
    description: 'Share how you shop online and offline to qualify for higher-value surveys.',
    estimatedMinutes: 9,
    rewardUSD: 1.1,
    providerKey: 'bitlabs',
    countryNote: 'Good fit for users with completed profiles.',
  },
  {
    id: 'finance-app-review',
    title: 'Finance App Feedback Survey',
    description: 'Review a digital banking or mobile money product and earn a reward.',
    estimatedMinutes: 12,
    rewardUSD: 1.4,
    providerKey: 'cpx',
    countryNote: 'Short screening questionnaire may apply.',
  },
];

const resolveSurveyWallUrl = (providerKey, user) => {
  if (providerKey === 'cpx') {
    const appId = process.env.CPX_RESEARCH_APP_ID;
    const hashKey = process.env.CPX_RESEARCH_HASH_KEY;
    if (!appId || !hashKey) return null;

    const hash = crypto.createHash('md5').update(`${user.userId}-${hashKey}`).digest('hex');
    return `https://offers.cpx-research.com/index.php?app_id=${appId}&ext_user_id=${user.userId}&secure_hash=${hash}&username=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email || '')}&subid_1=${user.country}`;
  }

  if (providerKey === 'bitlabs') {
    if (!process.env.BITLABS_API_TOKEN) return null;
    return `https://web.bitlabs.ai/?token=${process.env.BITLABS_API_TOKEN}&uid=${user.userId}`;
  }

  return null;
};

// @GET /api/surveys/cpx
// Returns CPX Research offerwall URL for the user
exports.getCPXSurveyWall = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.activationStatus) {
      return res.status(403).json({ success: false, message: 'Account activation required' });
    }

    const wallUrl = resolveSurveyWallUrl('cpx', user);

    if (!wallUrl) {
      return res.status(503).json({ success: false, message: 'CPX survey wall is not configured' });
    }

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

    const wallUrl = resolveSurveyWallUrl('bitlabs', user);

    if (!wallUrl) {
      return res.status(503).json({ success: false, message: 'BitLabs survey wall is not configured' });
    }

    res.json({ success: true, wallUrl });
  } catch (error) {
    logger.error(`getBitLabsWall error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/surveys/feed
exports.getSurveyFeed = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.activationStatus) {
      return res.status(403).json({ success: false, message: 'Account activation required' });
    }

    const surveyCategory = getCategoryProviders('surveys');
    const providers = (surveyCategory?.providers || []).map((provider) => {
      const url = resolveSurveyWallUrl(provider.key, user);
      return {
        key: provider.key,
        name: provider.name,
        description: provider.description,
        integrationType: provider.integrationType,
        access: provider.access,
        badge: provider.badge,
        url,
        live: Boolean(url),
      };
    });

    const surveys = SURVEY_TEMPLATE.map((survey) => {
      const provider = providers.find((entry) => entry.key === survey.providerKey) || null;
      return {
        ...survey,
        provider,
        canStart: Boolean(provider?.url),
      };
    });

    res.json({
      success: true,
      surveys,
      providers,
    });
  } catch (error) {
    logger.error(`getSurveyFeed error: ${error.message}`);
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
    await updateChallengeProgress(user._id, 'survey');

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
    await updateChallengeProgress(user._id, 'survey');

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
