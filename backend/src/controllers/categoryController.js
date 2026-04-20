const crypto = require('crypto');
const User = require('../models/User');
const logger = require('../utils/logger');
const { getCategoryProviderCatalog, getCategoryProviders } = require('../config/categoryProviders');

const buildSurveyWallUrl = (providerKey, user) => {
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

const buildOfferwallUrl = (providerKey, user) => {
  if (providerKey === 'ayetstudios') {
    const pubId = process.env.AYETSTUDIOS_PUB_ID;
    const apiKey = process.env.AYETSTUDIOS_API_KEY;
    if (!pubId || !apiKey) return null;

    const hash = crypto.createHash('sha256').update(`${pubId}${user.userId}${apiKey}`).digest('hex');
    return `https://www.ayetstudios.com/offers/web_offerwall/${pubId}?external_identifier=${user.userId}&placement=rewarded_offerwall&sign=${hash}`;
  }

  if (providerKey === 'adgate') {
    if (!process.env.ADGATE_PUBLISHER_ID) return null;
    return `https://wall.adgaterewards.com/${process.env.ADGATE_PUBLISHER_ID}/${user.userId}`;
  }

  return null;
};

const buildResolvedUrl = (categoryKey, providerKey, user) => {
  if (!user) return null;
  if (categoryKey === 'surveys') return buildSurveyWallUrl(providerKey, user);
  if (categoryKey === 'offerwalls') return buildOfferwallUrl(providerKey, user);
  if (categoryKey === 'ads_network' && providerKey === 'adgate_ads') return buildOfferwallUrl('adgate', user);
  if (categoryKey === 'ads_network' && providerKey === 'ayet_ads') return buildOfferwallUrl('ayetstudios', user);
  return null;
};

const resolveProviderForResponse = (categoryKey, provider, user) => {
  const resolvedUrl = buildResolvedUrl(categoryKey, provider.key, user);

  return {
    key: provider.key,
    name: provider.name,
    description: provider.description,
    integrationType: provider.integrationType,
    access: provider.access,
    badge: provider.badge,
    url: resolvedUrl || provider.externalUrl || null,
    live: Boolean(resolvedUrl || provider.externalUrl),
  };
};

exports.getCategoryCatalog = async (req, res) => {
  try {
    const catalog = getCategoryProviderCatalog();
    res.json({
      success: true,
      categories: Object.values(catalog).map((category) => ({
        key: category.key,
        title: category.title,
        description: category.description,
        providerCount: category.providers.length,
      })),
    });
  } catch (error) {
    logger.error(`getCategoryCatalog error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getProvidersByCategory = async (req, res) => {
  try {
    const { categoryKey } = req.params;
    const category = getCategoryProviders(categoryKey);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const user = req.user?.id ? await User.findById(req.user.id) : null;

    res.json({
      success: true,
      category: {
        key: category.key,
        title: category.title,
        description: category.description,
      },
      providers: category.providers.map((provider) => resolveProviderForResponse(categoryKey, provider, user)),
    });
  } catch (error) {
    logger.error(`getProvidersByCategory error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};
