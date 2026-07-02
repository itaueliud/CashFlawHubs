const crypto = require('crypto');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const { getRedis, isRedisReady } = require('../config/redis');
const logger = require('../utils/logger');
const { trackEvent, checkEarningMilestones } = require('../services/eventTracker');
const { getCategoryProviders } = require('../config/categoryProviders');

const SURVEY_SESSION_TTL_SECONDS = 60 * 60 * 12;
const SURVEY_REWARD_CAP_USD = 50;

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

const resolveSurveyTemplate = (surveyId, providerKey) => {
  if (surveyId) {
    return SURVEY_TEMPLATE.find((survey) => survey.id === surveyId && (!providerKey || survey.providerKey === providerKey)) || null;
  }

  if (providerKey) {
    return SURVEY_TEMPLATE.find((survey) => survey.providerKey === providerKey) || null;
  }

  return SURVEY_TEMPLATE[0] || null;
};

const getSurveyProviders = () => {
  const surveyCategory = getCategoryProviders('surveys');
  return surveyCategory?.providers || [];
};

const resolveSurveyProvider = (providerKey, user) => {
  const providers = getSurveyProviders();
  const provider = providers.find((entry) => entry.key === providerKey) || null;
  const url = provider ? resolveSurveyWallUrl(provider.key, user) : null;

  return provider
    ? {
        key: provider.key,
        name: provider.name,
        description: provider.description,
        integrationType: provider.integrationType,
        access: provider.access,
        badge: provider.badge,
        url,
        live: Boolean(url),
      }
    : null;
};

const getOrCreateWallet = async (user) => {
  let wallet = await Wallet.findOne({ userId: user._id });
  if (!wallet) {
    wallet = await Wallet.create({ userId: user._id });
  }

  return wallet;
};

const getRewardAmountUSD = (value) => {
  const amount = Number.parseFloat(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.min(Number(amount.toFixed(4)), SURVEY_REWARD_CAP_USD);
};

const getUtcDayStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const createSurveySession = async ({ user, providerKey, survey }) => {
  const sessionId = `SUR-${providerKey}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const payload = {
    sessionId,
    userId: user._id.toString(),
    userCode: user.userId,
    providerKey,
    surveyId: survey?.id || null,
    expectedRewardUSD: survey?.rewardUSD || null,
    createdAt: new Date().toISOString(),
  };

  if (isRedisReady()) {
    try {
      await getRedis().setex(`survey:session:${sessionId}`, SURVEY_SESSION_TTL_SECONDS, JSON.stringify(payload));
    } catch (error) {
      logger.warn(`Survey session store failed: ${error.message}`);
    }
  }

  return payload;
};

const resolveSurveySession = async (sessionId) => {
  if (!sessionId || !isRedisReady()) return null;

  try {
    const raw = await getRedis().get(`survey:session:${sessionId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    logger.warn(`Survey session lookup failed: ${error.message}`);
    return null;
  }
};

const resolveCallbackIdentifiers = (req) => ({
  sessionId: req.query.session_id || req.query.sessionId || req.query.sid || req.query.subid_2 || req.body?.session_id || req.body?.sessionId || req.body?.sid || req.body?.subid_2 || null,
  providerTxId: req.query.trans_id || req.query.transaction_id || req.body?.transaction_id || req.body?.trans_id || req.body?.transactionId || null,
});

const isDuplicateSurveyReward = async ({ providerKey, providerTxId }) => {
  if (!providerTxId) return false;

  const existing = await Transaction.findOne({
    type: 'survey',
    providerTransactionId: providerTxId,
    'metadata.provider': providerKey,
    status: 'successful',
  }).lean();

  return Boolean(existing);
};

const buildSurveyLaunchUrl = ({ providerKey, user, sessionId }) => {
  if (providerKey === 'cpx') {
    const appId = process.env.CPX_RESEARCH_APP_ID;
    const hashKey = process.env.CPX_RESEARCH_HASH_KEY;
    if (!appId || !hashKey) return null;

    const hash = crypto.createHash('md5').update(`${user.userId}-${hashKey}`).digest('hex');
    const params = new URLSearchParams({
      app_id: appId,
      ext_user_id: user.userId,
      secure_hash: hash,
      username: user.name || '',
      email: user.email || '',
      subid_1: user.country,
      subid_2: sessionId,
    });

    return `https://offers.cpx-research.com/index.php?${params.toString()}`;
  }

  if (providerKey === 'bitlabs') {
    if (!process.env.BITLABS_API_TOKEN) return null;
    const params = new URLSearchParams({
      token: process.env.BITLABS_API_TOKEN,
      uid: user.userId,
      sid: sessionId,
    });

    return `https://web.bitlabs.ai/?${params.toString()}`;
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

    const providers = getSurveyProviders().map((provider) => {
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
        launchPath: `/surveys/launch/${survey.providerKey}/${survey.id}`,
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

// @GET /api/surveys/launch/:providerKey/:surveyId?
// Creates a tracked survey session and returns the wall URL
exports.launchSurvey = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.activationStatus) {
      return res.status(403).json({ success: false, message: 'Account activation required' });
    }

    const { providerKey, surveyId } = req.params;
    const survey = resolveSurveyTemplate(surveyId, providerKey);
    if (!survey) {
      return res.status(404).json({ success: false, message: 'Survey not found' });
    }

    const provider = resolveSurveyProvider(providerKey, user);
    if (!provider?.live) {
      return res.status(503).json({ success: false, message: `${providerKey} survey wall is not configured` });
    }

    const session = await createSurveySession({ user, providerKey, survey });
    const wallUrl = buildSurveyLaunchUrl({ providerKey, user, sessionId: session.sessionId });

    if (!wallUrl) {
      return res.status(503).json({ success: false, message: `${providerKey} survey wall is not configured` });
    }

    res.json({
      success: true,
      sessionId: session.sessionId,
      survey,
      provider,
      wallUrl,
    });
  } catch (error) {
    logger.error(`launchSurvey error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/surveys/cpx/callback
// CPX postback when user completes a survey
exports.cpxCallback = async (req, res) => {
  try {
    const { user_id, amount_local, trans_id, hash } = req.query;
    const { sessionId, providerTxId } = resolveCallbackIdentifiers(req);

    if (!process.env.CPX_RESEARCH_HASH_KEY) {
      return res.status(503).send('1');
    }

    // Verify hash
    const expected = crypto
      .createHash('md5')
      .update(`${user_id}${process.env.CPX_RESEARCH_HASH_KEY}`)
      .digest('hex');

    if (hash !== expected) {
      logger.warn(`CPX callback hash mismatch for user ${user_id}`);
      return res.status(401).send('1'); // CPX expects '1' on error
    }

    const callbackTxId = providerTxId || trans_id;

    if (await isDuplicateSurveyReward({ providerKey: 'cpx', providerTxId: callbackTxId })) {
      return res.send('1');
    }

    if (isRedisReady()) {
      try {
        const redis = getRedis();
        const dupKey = `cpx:tx:${callbackTxId}`;
        const isDup = await redis.get(dupKey);
        if (isDup) return res.send('1');
        await redis.setex(dupKey, 86400, '1');
      } catch (error) {
        logger.warn(`CPX duplicate guard failed: ${error.message}`);
      }
    }

    const user = await User.findOne({ userId: user_id });
    if (!user) return res.send('1');

    const amountUSD = getRewardAmountUSD(amount_local);
    if (!amountUSD) return res.send('1');

    const session = await resolveSurveySession(sessionId);
    if (session && session.userId !== user._id.toString()) {
      logger.warn(`CPX callback session mismatch for ${callbackTxId}`);
      return res.send('1');
    }

    // XP reward
    const xpAwarded = Math.max(Math.round(amountUSD), 0);

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
      providerTransactionId: callbackTxId,
      processedAt: new Date(),
      metadata: {
        provider: 'cpx',
        providerName: 'CPX Research',
        sessionId: session?.sessionId || sessionId || null,
        surveyId: session?.surveyId || null,
        xpAwarded,
      },
    });

    // Apply XP points
    await User.findByIdAndUpdate(user._id, { $inc: { xpPoints: xpAwarded, surveysCompleted: 1 } });
    await trackEvent(user._id, 'survey_complete');

    const startOfDay = getUtcDayStart();
    const todaySurveys = await Transaction.countDocuments({
      userId: user._id,
      type: 'survey',
      status: 'successful',
      createdAt: { $gte: startOfDay },
    });
    if (todaySurveys >= 3) await trackEvent(user._id, 'survey_complete_3');
    await checkEarningMilestones(user._id);

    logger.info(`CPX survey reward: ${xpAwarded} XP for user ${user_id}`);
    res.send('1'); // CPX expects '1' on success
  } catch (error) {
    logger.error(`cpxCallback error: ${error.message}`);
    res.send('1');
  }
};

// @POST /api/surveys/bitlabs/callback
exports.bitlabsCallback = async (req, res) => {
  try {
    const { uid, reward, transaction_id, signature } = req.body;
    const { sessionId, providerTxId } = resolveCallbackIdentifiers(req);
    const callbackTxId = providerTxId || transaction_id;

    if (process.env.BITLABS_CALLBACK_SECRET && signature) {
      const expectedSignature = crypto
        .createHmac('sha256', process.env.BITLABS_CALLBACK_SECRET)
        .update(`${uid}:${reward}:${callbackTxId}`)
        .digest('hex');

      if (signature !== expectedSignature) {
        logger.warn(`BitLabs signature mismatch: ${callbackTxId}`);
        return res.status(401).json({ success: false });
      }
    }

    if (await isDuplicateSurveyReward({ providerKey: 'bitlabs', providerTxId: callbackTxId })) {
      return res.json({ success: true });
    }

    if (isRedisReady()) {
      try {
        const redis = getRedis();
        const dupKey = `bitlabs:tx:${callbackTxId}`;
        if (await redis.get(dupKey)) return res.json({ success: true });
        await redis.setex(dupKey, 86400, '1');
      } catch (error) {
        logger.warn(`BitLabs duplicate guard failed: ${error.message}`);
      }
    }

    const user = await User.findOne({ userId: uid });
    if (!user) return res.status(404).json({ success: false });

    const amountUSD = getRewardAmountUSD(reward);
    if (!amountUSD) return res.status(400).json({ success: false });

    const session = await resolveSurveySession(sessionId);
    if (session && session.userId !== user._id.toString()) {
      logger.warn(`BitLabs callback session mismatch for ${callbackTxId}`);
      return res.status(400).json({ success: false });
    }

    const xpAwarded = Math.max(Math.round(amountUSD), 0);

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
      providerTransactionId: callbackTxId,
      processedAt: new Date(),
      metadata: {
        provider: 'bitlabs',
        providerName: 'BitLabs',
        sessionId: session?.sessionId || sessionId || null,
        surveyId: session?.surveyId || null,
        xpAwarded,
      },
    });

    await User.findByIdAndUpdate(user._id, { $inc: { xpPoints: xpAwarded, surveysCompleted: 1 } });
    await trackEvent(user._id, 'survey_complete');

    const startOfDay = getUtcDayStart();
    const todaySurveys = await Transaction.countDocuments({
      userId: user._id,
      type: 'survey',
      status: 'successful',
      createdAt: { $gte: startOfDay },
    });
    if (todaySurveys >= 3) await trackEvent(user._id, 'survey_complete_3');
    await checkEarningMilestones(user._id);

    logger.info(`BitLabs reward: ${xpAwarded} XP for user ${uid}`);
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
