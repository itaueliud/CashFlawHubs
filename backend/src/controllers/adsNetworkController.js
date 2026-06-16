const crypto = require('crypto');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const AdsSession = require('../models/AdsSession');
const { Challenge, ChallengeCompletion } = require('../models/Challenge');
const logger = require('../utils/logger');
const { getCategoryProviders } = require('../config/categoryProviders');
const { trackEvent } = require('../services/eventTracker');

const AD_SESSION_TTL_SECONDS = 60 * 60 * 12;
const REWARDED_AD_PROVIDER_KEYS = new Set(['adgate_ads', 'ayet_ads']);
const ADS_WATCH_THRESHOLD_SECONDS = 2 * 60 * 60;
const ADS_CHALLENGE_EVENT = 'ads_earning_2hr';

const resolveProviders = () => {
  const category = getCategoryProviders('ads_network');
  const providers = category?.providers || [];
  return { category, providers };
};

const mapProvider = (provider, user) => {
  const url = buildAdNetworkUrl(provider.key, user) || provider.externalUrl || null;
  const live = Boolean(url);

  return {
    key: provider.key,
    name: provider.name,
    description: provider.description,
    integrationType: provider.integrationType,
    access: provider.access,
    badge: provider.badge,
    url,
    live,
    status: live ? 'available' : 'coming_soon',
    launchPath: `/ads-network/launch/${provider.key}`,
  };
};

const createAdSession = async ({ user, providerKey }) => {
  const sessionId = `AD-${providerKey}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const payload = {
    sessionId,
    userId: user._id.toString(),
    userCode: user.userId,
    providerKey,
    createdAt: new Date().toISOString(),
  };

  if (isRedisReady()) {
    try {
      await getRedis().setex(`ads:session:${sessionId}`, AD_SESSION_TTL_SECONDS, JSON.stringify(payload));
    } catch (error) {
      logger.warn(`Ads session store failed: ${error.message}`);
    }
  }

  return payload;
};

const getNextAdsResetAt = (now = new Date()) => {
  const utcNow = new Date(now);
  const eatMs = utcNow.getTime() + (3 * 60 * 60 * 1000);
  const eatDate = new Date(eatMs);
  const nextEatMidnightUtc = Date.UTC(eatDate.getUTCFullYear(), eatDate.getUTCMonth(), eatDate.getUTCDate() + 1);
  return new Date(nextEatMidnightUtc - (3 * 60 * 60 * 1000));
};

const formatAdsSession = (session, now = new Date()) => ({
  active: Boolean(session),
  windowStartedAt: session?.windowStartedAt || null,
  windowExpiresAt: session?.windowExpiresAt || null,
  lastHeartbeatAt: session?.lastHeartbeatAt || null,
  accumulatedSeconds: Number(session?.accumulatedSeconds || 0),
  rewardGrantedAt: session?.rewardGrantedAt || null,
  rewardChallengeId: session?.rewardChallengeId || null,
  thresholdSeconds: ADS_WATCH_THRESHOLD_SECONDS,
  remainingSeconds: session?.windowExpiresAt ? Math.max(0, Math.ceil((new Date(session.windowExpiresAt).getTime() - now.getTime()) / 1000)) : Math.max(0, Math.ceil((getNextAdsResetAt(now).getTime() - now.getTime()) / 1000)),
});

const ensureWatchSession = async ({ userId, countElapsed = true }) => {
  const now = new Date();
  let session = await AdsSession.findOne({ userId });

  if (!session || !session.windowStartedAt || !session.windowExpiresAt || new Date(session.windowExpiresAt) <= now) {
    session = new AdsSession({
      userId,
      windowStartedAt: now,
      windowExpiresAt: getNextAdsResetAt(now),
      lastHeartbeatAt: now,
      accumulatedSeconds: 0,
      rewardGrantedAt: null,
      rewardChallengeId: null,
    });
  } else {
    if (countElapsed) {
      const lastHeartbeatAt = session.lastHeartbeatAt ? new Date(session.lastHeartbeatAt) : new Date(session.windowStartedAt || now);
      const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - lastHeartbeatAt.getTime()) / 1000));
      if (elapsedSeconds > 0) {
        session.accumulatedSeconds = Number(session.accumulatedSeconds || 0) + elapsedSeconds;
      }
    }

    session.lastHeartbeatAt = now;
    session.windowExpiresAt = getNextAdsResetAt(now);
  }

  if (session.accumulatedSeconds >= ADS_WATCH_THRESHOLD_SECONDS && !session.rewardGrantedAt) {
    const activeChallenge = await Challenge.findOne({
      isActive: true,
      isDaily: true,
      eventType: ADS_CHALLENGE_EVENT,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).sort({ createdAt: -1 });

    if (activeChallenge) {
      const completion = await ChallengeCompletion.findOne({
        userId,
        challengeId: activeChallenge._id,
        completed: true,
        rewardClaimed: false,
      });

      if (completion) {
        await trackEvent(userId, ADS_CHALLENGE_EVENT);
        session.rewardGrantedAt = now;
        session.rewardChallengeId = activeChallenge._id;
      }
    }
  }

  await session.save();
  return session;
};

const buildAdNetworkUrl = (providerKey, user) => {
  if (providerKey === 'adgate_ads') {
    const pubId = process.env.ADGATE_PUBLISHER_ID;
    if (!pubId) return null;
    return `https://wall.adgaterewards.com/${pubId}/${user.userId}`;
  }

  if (providerKey === 'ayet_ads') {
    const pubId = process.env.AYETSTUDIOS_PUB_ID;
    const apiKey = process.env.AYETSTUDIOS_API_KEY;
    if (!pubId || !apiKey) return null;

    const hash = crypto.createHash('sha256').update(`${pubId}${user.userId}${apiKey}`).digest('hex');
    return `https://www.ayetstudios.com/offers/web_offerwall/${pubId}?external_identifier=${user.userId}&placement=ads_network&sign=${hash}`;
  }

  return null;
};

exports.getAdsWatchStatus = async (req, res) => {
  try {
    const session = await ensureWatchSession({ userId: req.user.id, countElapsed: false });
    res.json({
      success: true,
      session: formatAdsSession(session),
    });
  } catch (error) {
    logger.error(`getAdsWatchStatus error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.startAdsWatchSession = async (req, res) => {
  try {
    const session = await ensureWatchSession({ userId: req.user.id, countElapsed: false });
    res.json({
      success: true,
      session: formatAdsSession(session),
    });
  } catch (error) {
    logger.error(`startAdsWatchSession error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.recordAdsWatchHeartbeat = async (req, res) => {
  try {
    const session = await ensureWatchSession({ userId: req.user.id, countElapsed: true });
    res.json({
      success: true,
      session: formatAdsSession(session),
    });
  } catch (error) {
    logger.error(`recordAdsWatchHeartbeat error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.endAdsWatchSession = async (req, res) => {
  try {
    const session = await ensureWatchSession({ userId: req.user.id, countElapsed: true });
    res.json({
      success: true,
      session: formatAdsSession(session),
    });
  } catch (error) {
    logger.error(`endAdsWatchSession error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAdsNetworkProviders = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { category, providers: catalogProviders } = resolveProviders();
    const providers = catalogProviders.map((provider) => mapProvider(provider, user));

    res.json({
      success: true,
      category: {
        key: 'ads_network',
        title: category?.title || 'Ads / Ad Network',
        description: category?.description || 'Ad networks and rewarded ad partners.',
      },
      liveProviders: providers.filter((provider) => provider.live),
      plannedProviders: providers.filter((provider) => !provider.live),
      totalProviders: providers.length,
      activeProviders: providers.filter((provider) => provider.live).length,
    });
  } catch (error) {
    logger.error(`getAdsNetworkProviders error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/ads-network/launch/:providerKey
exports.launchAdsProvider = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { providerKey } = req.params;
    if (!REWARDED_AD_PROVIDER_KEYS.has(providerKey)) {
      return res.status(400).json({ success: false, message: 'Invalid ad provider' });
    }

    const { providers } = resolveProviders();
    const provider = providers.find((entry) => entry.key === providerKey);
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    const session = await createAdSession({ user, providerKey });
    const wallUrl = buildAdNetworkUrl(providerKey, user) || provider.externalUrl || null;
    if (!wallUrl) {
      return res.status(503).json({ success: false, message: 'Provider is not configured yet' });
    }

    res.json({
      success: true,
      sessionId: session.sessionId,
      provider: mapProvider(provider, user),
      wallUrl,
    });
  } catch (error) {
    logger.error(`launchAdsProvider error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/ads-network/history
exports.getAdsNetworkHistory = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNumber = Number(page);
    const pageSize = Number(limit);
    const skip = (pageNumber - 1) * pageSize;

    const query = {
      userId: req.user.id,
      type: 'offer',
      'metadata.provider': { $in: ['adgate', 'ayetstudios'] },
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
    logger.error(`getAdsNetworkHistory error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};
