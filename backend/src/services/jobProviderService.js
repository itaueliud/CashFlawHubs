const axios = require('axios');
const logger = require('../utils/logger');

const COUNTRY_MAP = {
  KE: 'Kenya',
  UG: 'Uganda',
  TZ: 'Tanzania',
  ET: 'Ethiopia',
  GH: 'Ghana',
  NG: 'Nigeria',
};

const FALLBACK_COMPANIES = [
  {
    id: 'fallback-1',
    name: 'RemoteFirst Labs',
    headline: 'Hiring product designers and frontend engineers in East Africa',
    location: 'Remote / Nairobi',
    industry: 'Product',
    description: 'A distributed product studio that is actively hiring around frontend and product design work.',
    links: [{ label: 'View opening', url: 'https://example.com/remotefirst' }],
  },
  {
    id: 'fallback-2',
    name: 'Northstar AI',
    headline: 'Building data and AI products for SMBs in Africa',
    location: 'Kampala',
    industry: 'AI',
    description: 'Northstar AI is growing its engineering and operations teams and frequently posts remote roles.',
    links: [{ label: 'View opening', url: 'https://example.com/northstar' }],
  },
];

const FALLBACK_ALERTS = [
  {
    id: 'fallback-alert-1',
    title: 'Frontend Engineer',
    organization: 'RemoteFirst Labs',
    location: 'Remote',
    postedAt: new Date().toISOString(),
    source: 'LoopCV fallback',
    summary: 'Remote-first React and Next.js roles are available this week.',
  },
  {
    id: 'fallback-alert-2',
    title: 'Growth Operations Specialist',
    organization: 'Northstar AI',
    location: 'Nairobi',
    postedAt: new Date().toISOString(),
    source: 'LoopCV fallback',
    summary: 'Operations and growth roles are opening for teams scaling in Africa.',
  },
];

const normalizeProviderAlert = (alert = {}) => {
  const skill = String(alert.skill || '').trim();
  const country = String(alert.country || 'KE').toUpperCase();
  const keywords = Array.isArray(alert.keywords)
    ? alert.keywords.map((item) => String(item).trim()).filter(Boolean)
    : [];

  return {
    skill,
    country: COUNTRY_MAP[country] ? country : 'KE',
    keywords,
  };
};

const buildProviderStatus = ({ theirStackConfigured = false, loopcvConfigured = false } = {}) => ({
  theirStack: {
    status: theirStackConfigured ? 'ready' : 'unconfigured',
    message: theirStackConfigured
      ? 'TheirStack API is configured and will be queried live.'
      : 'TheirStack is not configured yet; the UI is using a fallback company feed.',
  },
  loopcv: {
    status: loopcvConfigured ? 'ready' : 'unconfigured',
    message: loopcvConfigured
      ? 'LoopCV API is configured and will be queried live.'
      : 'LoopCV is not configured yet; the UI is using a fallback alert feed.',
  },
});

const getTheirStackClient = () => {
  const apiKey = process.env.THEIRSTACK_API_KEY;
  if (!apiKey) {
    return null;
  }

  return axios.create({
    baseURL: process.env.THEIRSTACK_API_URL || 'https://api.theirstack.com/v1',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 20000,
  });
};

const getLoopcvClient = () => {
  const apiKey = process.env.LOOPCV_API_KEY;
  if (!apiKey) {
    return null;
  }

  return axios.create({
    baseURL: process.env.LOOPCV_API_URL || 'https://api.loopcv.pro/v1',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 20000,
  });
};

async function getTheirStackCompanies({ country = 'KE', skill = '', page = 0, limit = 20 } = {}) {
  const client = getTheirStackClient();
  if (!client) {
    return { companies: FALLBACK_COMPANIES.slice(0, Math.max(1, limit)), source: 'fallback' };
  }

  const countryName = COUNTRY_MAP[country] || 'Kenya';
  try {
    const response = await client.post('/companies/search', {
      limit,
      page,
      posted_at_max_age_days: 60,
      job_country_code_or: [country],
      order_by: [{ desc: true, field: 'discovered_at' }],
      include_total_results: true,
      ...(skill ? { job_title_pattern_or: [skill.trim()] } : {}),
    });

    const companies = Array.isArray(response.data?.results)
      ? response.data.results.map((item, index) => ({
          id: item.id || `theirstack-${index}`,
          name: item.company_name || item.company || 'Unknown company',
          headline: item.job_title || item.title || 'Hiring now',
          location: item.location || countryName,
          industry: item.industry || 'Technology',
          description: item.description || item.summary || 'Open roles are available right now.',
          links: Array.isArray(item.links) && item.links.length ? item.links : [{ label: 'View opening', url: item.url || '#' }],
        }))
      : [];

    return { companies, source: 'live' };
  } catch (error) {
    logger.warn(`TheirStack provider failed: ${error.message}`);
    return { companies: FALLBACK_COMPANIES.slice(0, Math.max(1, limit)), source: 'fallback' };
  }
}

async function getLoopcvAlerts({ country = 'KE', skill = '', limit = 20 } = {}) {
  const client = getLoopcvClient();
  if (!client) {
    return { alerts: FALLBACK_ALERTS.slice(0, Math.max(1, limit)), source: 'fallback' };
  }

  try {
    const response = await client.get('/jobs', {
      params: {
        country,
        keyword: skill || undefined,
        limit,
      },
    });

    const alerts = Array.isArray(response.data?.jobs || response.data?.results)
      ? (response.data.jobs || response.data.results).map((item, index) => ({
          id: item.id || `loopcv-${index}`,
          title: item.title || item.job_title || 'Open role',
          organization: item.company || item.organization || 'Unknown company',
          location: item.location || COUNTRY_MAP[country] || 'Remote',
          postedAt: item.posted_at || item.postedAt || new Date().toISOString(),
          source: 'LoopCV',
          summary: item.summary || item.description || 'A new role is available for this skill.',
        }))
      : [];

    return { alerts, source: 'live' };
  } catch (error) {
    logger.warn(`LoopCV provider failed: ${error.message}`);
    return { alerts: FALLBACK_ALERTS.slice(0, Math.max(1, limit)), source: 'fallback' };
  }
}

module.exports = {
  COUNTRY_MAP,
  normalizeProviderAlert,
  buildProviderStatus,
  getTheirStackCompanies,
  getLoopcvAlerts,
};
