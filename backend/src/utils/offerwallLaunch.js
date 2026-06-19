const crypto = require('crypto');

const DEFAULT_LOCALE = 'en';
const FALLBACK_OFFERWALL_URLS = {
  cpa: 'https://www.cdnflair.com/wall/dJ6T',
  adgem: '',
};

const OFFERWALL_PROVIDER_CONFIGS = {
  cpa: {
    key: 'cpa',
    name: 'CPAlead',
    description: 'Rewarded offerwall inventory from CPAlead.',
    integrationType: 'api',
    access: 'signed_wall',
    badge: 'Live',
    urlEnvKeys: [
      'CPALEAD_OFFERWALL_URL',
      'CPALEAD_NATIVE_OFFERS_URL',
      'NEXT_PUBLIC_CPALEAD_OFFERWALL_URL',
      'NEXT_PUBLIC_CPALEAD_NATIVE_OFFERS_URL',
      'VITE_CPALEAD_OFFERWALL_URL',
      'VITE_CPALEAD_NATIVE_OFFERS_URL',
    ],
  },
  adgem: {
    key: 'adgem',
    name: 'AdGem',
    description: 'Rewarded offerwall inventory from AdGem.',
    integrationType: 'api',
    access: 'signed_wall',
    badge: 'Live',
    urlEnvKeys: [
      'ADGEM_APP_ID',
      'NEXT_PUBLIC_ADGEM_APP_ID',
      'VITE_ADGEM_APP_ID',
    ],
  },
  ayetstudios: {
    key: 'ayetstudios',
    name: 'Ayet Studios',
    description: 'Rewarded offerwall inventory from Ayet Studios.',
    integrationType: 'api',
    access: 'signed_wall',
    badge: 'Live',
    urlEnvKeys: ['AYETSTUDIOS_PUB_ID', 'AYETSTUDIOS_API_KEY'],
  },
  adgate: {
    key: 'adgate',
    name: 'AdGate Rewards',
    description: 'Rewarded installs and offerwall inventory from AdGate.',
    integrationType: 'api',
    access: 'internal_wall',
    badge: 'Live',
    urlEnvKeys: ['ADGATE_PUBLISHER_ID'],
  },
};

const OFFERWALL_PROVIDER_KEYS = new Set(Object.keys(OFFERWALL_PROVIDER_CONFIGS));

const firstConfiguredValue = (...values) => values.find((value) => String(value || '').trim());

const normalizeLocale = (value) => {
  const trimmed = String(value || '').trim().replace(/_/g, '-');
  if (!trimmed) return '';
  return trimmed;
};

const getOfferwallContext = ({ req, user, sessionId } = {}) => {
  const acceptLanguage = String(req?.headers?.['accept-language'] || '').trim();
  const headerLocale = acceptLanguage.split(',')[0].split(';')[0].trim();
  const userLocale = String(user?.userLanguage || '').trim();
  const browserLocale = String(user?.browserLanguage || '').trim();
  const locale = normalizeLocale(firstConfiguredValue(headerLocale, userLocale, browserLocale, DEFAULT_LOCALE) || DEFAULT_LOCALE);
  const language = locale.split('-')[0].toLowerCase() || DEFAULT_LOCALE;

  return {
    user,
    sessionId: sessionId || '',
    locale,
    language,
    acceptLanguage,
    timezone: String(user?.timezone || req?.headers?.['x-timezone'] || '').trim(),
    country: String(user?.country || '').trim(),
  };
};

const applyTemplateTokens = (template, params) => {
  const pattern = /\{\{(\w+)\}\}/g;
  return String(template || '').replace(pattern, (_, key) => encodeURIComponent(params[key] ?? ''));
};

const buildUrlFromTemplate = (template, params) => {
  if (!template) return null;

  const withTokens = applyTemplateTokens(template, params);

  try {
    const url = new URL(withTokens);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      const normalized = String(value).trim();
      if (!normalized) continue;
      if (!url.searchParams.has(key)) {
        url.searchParams.set(key, normalized);
      }
    }
    return url.toString();
  } catch {
    return withTokens;
  }
};

const getOfferwallUrlTemplate = (providerKey) => {
  const config = OFFERWALL_PROVIDER_CONFIGS[providerKey];
  if (!config) return '';

  if (providerKey === 'cpa') {
    return firstConfiguredValue(
      ...config.urlEnvKeys.map((key) => process.env[key]),
      FALLBACK_OFFERWALL_URLS[providerKey]
    ) || '';
  }

  if (providerKey === 'ayetstudios') {
    const pubId = process.env.AYETSTUDIOS_PUB_ID;
    if (!pubId) return '';
    return `https://www.ayetstudios.com/offers/web_offerwall/${pubId}`;
  }

  if (providerKey === 'adgate') {
    const pubId = process.env.ADGATE_PUBLISHER_ID;
    if (!pubId) return '';
    return `https://wall.adgaterewards.com/${pubId}`;
  }

  return '';
};

const getOfferwallLaunchParams = (providerKey, context = {}) => {
  const commonParams = {
    userId: context.user?.userId || '',
    user_id: context.user?.userId || '',
    userID: context.user?.userId || '',
    ext_user_id: context.user?.userId || '',
    external_identifier: context.user?.userId || '',
    subid_1: context.country || '',
    subid_2: context.sessionId || '',
    country: context.country || '',
    locale: context.locale || '',
    lang: context.language || '',
    language: context.language || '',
    timezone: context.timezone || '',
    browser_language: context.acceptLanguage || '',
    email: context.user?.email || '',
    username: context.user?.name || '',
  };

  if (providerKey === 'ayetstudios') {
    return {
      ...commonParams,
      placement: 'rewarded_offerwall',
    };
  }

  if (providerKey === 'adgate') {
    return {
      ...commonParams,
    };
  }

  if (providerKey === 'adgem') {
    return {
      ...commonParams,
      appid: process.env.ADGEM_APP_ID || '',
      playerid: context.user?.userId || '',
    };
  }

  return commonParams;
};

const buildOfferwallLaunchUrl = (providerKey, context = {}) => {
  if (providerKey === 'ayetstudios') {
    const pubId = process.env.AYETSTUDIOS_PUB_ID;
    const apiKey = process.env.AYETSTUDIOS_API_KEY;
    if (!pubId || !apiKey || !context.user?.userId) return null;

    const hash = crypto.createHash('sha256').update(`${pubId}${context.user.userId}${apiKey}`).digest('hex');
    const params = {
      ...getOfferwallLaunchParams(providerKey, context),
      sign: hash,
      placement: 'rewarded_offerwall',
    };

    return buildUrlFromTemplate(`https://www.ayetstudios.com/offers/web_offerwall/${pubId}`, params);
  }

  if (providerKey === 'adgate') {
    const pubId = process.env.ADGATE_PUBLISHER_ID;
    if (!pubId || !context.user?.userId) return null;

    const params = getOfferwallLaunchParams(providerKey, context);
    return buildUrlFromTemplate(`https://wall.adgaterewards.com/${pubId}/${context.user.userId}`, params);
  }

  if (providerKey === 'adgem') {
    const appId = process.env.ADGEM_APP_ID || '32838';
    if (!appId || !context.user?.userId) return null;

    return buildUrlFromTemplate(
      `https://adunits.adgem.com/wall?appid=${encodeURIComponent(appId)}&playerid=${encodeURIComponent(context.user.userId)}`,
      {}
    );
  }

  const template = getOfferwallUrlTemplate(providerKey);
  if (!template) return null;

  const params = getOfferwallLaunchParams(providerKey, context);
  return buildUrlFromTemplate(template, params);
};

const getOfferwallProvider = (providerKey, context = {}) => {
  const config = OFFERWALL_PROVIDER_CONFIGS[providerKey];
  if (!config) return null;

  const url = buildOfferwallLaunchUrl(providerKey, context);
  return {
    key: config.key,
    name: config.name,
    description: config.description,
    integrationType: config.integrationType,
    access: config.access,
    badge: config.badge,
    url,
    live: Boolean(url),
  };
};

module.exports = {
  OFFERWALL_PROVIDER_KEYS,
  buildOfferwallLaunchUrl,
  getOfferwallContext,
  getOfferwallProvider,
};
