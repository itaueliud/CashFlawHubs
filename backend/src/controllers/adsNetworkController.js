const crypto = require('crypto');
const User = require('../models/User');
const logger = require('../utils/logger');
const { getCategoryProviders } = require('../config/categoryProviders');

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
    return `https://www.ayetstudios.com/offers/web_offerwall/${pubId}?external_identifier=${user.userId}&placement=rewarded_offerwall&sign=${hash}`;
  }

  return null;
};

exports.getAdsNetworkProviders = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const category = getCategoryProviders('ads_network');
    const providers = (category?.providers || []).map((provider) => {
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
      };
    });

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
