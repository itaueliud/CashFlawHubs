const crypto = require('crypto');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { getRedis, isRedisReady } = require('../config/redis');
const logger = require('../utils/logger');
const { getCategoryProviders } = require('../config/categoryProviders');

const AD_SESSION_TTL_SECONDS = 60 * 60 * 12;
const REWARDED_AD_PROVIDER_KEYS = new Set(['adgate_ads', 'ayet_ads']);

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
