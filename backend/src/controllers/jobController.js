const axios = require('axios');
const Parser = require('rss-parser');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const Transaction = require('../models/Transaction');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');
const { JOB_APPLICATION_TOKEN_TIERS, TOKEN_PACKAGES, JOB_POSTING_TOKEN_COST, getApplicationTokenCost } = require('../config/monetization');
const rssParser = new Parser();
const DEFAULT_JOB_CATEGORIES = [
  'Software Development',
  'Product Management',
  'Data Science',
  'DevOps & Cloud',
  'Design',
  'Marketing',
  'Customer Support',
  'Writing',
  'Data Entry',
  'Virtual Assistance',
  'Finance',
  'Sales',
  'Human Resources',
  'Legal',
  'Operations',
  'Cybersecurity',
  'QA & Testing',
  'Business Analysis',
  'Project Management',
  'Other',
];
const { discoverApplicationContact } = require('../utils/jobContact');
const normalizeJobApplicationStatus = (status) => {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'submitted') return 'redirected';
  if (normalized === 'reviewed') return 'interviewing';
  if (normalized === 'shortlisted') return 'offered';
  return normalized;
};

const normalizeJobType = (value, fallback = 'full-time') => {
  if (Array.isArray(value)) {
    const first = value.find((item) => String(item || '').trim());
    return first ? String(first).trim().toLowerCase() : fallback;
  }
  const normalized = String(value || '').trim();
  return normalized ? normalized.toLowerCase() : fallback;
};

const normalizeAdzunaCategory = (category) => {
  const label = String(category?.label || category?.tag || '').trim();
  if (!label) return 'Other';
  return label.replace(/\s+Jobs$/i, '').trim() || 'Other';
};

const formatAdzunaSalary = (job) => {
  const min = Number(job.salary_min) || null;
  const max = Number(job.salary_max) || null;
  if (min && max) return `${Math.round(min)} - ${Math.round(max)}`;
  if (min) return `${Math.round(min)}+`;
  if (max) return `Up to ${Math.round(max)}`;
  return null;
};

const normalizeJobText = (value = '') => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');

const buildJobDedupKey = (job = {}) => {
  const source = normalizeJobText(job.source);
  const title = normalizeJobText(job.title);
  const company = normalizeJobText(job.company);
  const location = normalizeJobText(job.location);
  return [source, title, company, location].join('|');
};

const WWR_FEEDS = [
  { url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss', category: 'Software Development' },
  { url: 'https://weworkremotely.com/categories/remote-design-jobs.rss', category: 'Design' },
  { url: 'https://weworkremotely.com/categories/remote-marketing-jobs.rss', category: 'Marketing' },
  { url: 'https://weworkremotely.com/remote-jobs.rss', category: 'Other' },
];

const createWWRExternalId = (job) => {
  const raw = String(job.link || job.guid || `${job.title || 'wwr'}-${job.creator || 'company'}-${job.pubDate || Date.now()}`)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
  return `weworkremotely-${raw.replace(/^-+|-+$/g, '') || 'job'}`;
};

const normalizeWWRItem = (job, category = 'Other') => {
  const applicationUrl = String(job.link || job.guid || '').trim();
  if (!applicationUrl || !job.title) return null;

  return {
    externalId: createWWRExternalId(job),
    title: String(job.title).trim(),
    company: String(job.creator || job.author || 'Unknown company').trim() || 'Unknown company',
    category,
    description: stripHtml(job.contentSnippet || job.content || '').slice(0, 4000),
    applicationUrl,
    publishedAt: job.pubDate ? new Date(job.pubDate) : new Date(),
    tags: ['weworkremotely', category.toLowerCase()],
  };
};

const fetchWWRJobs = async () => {
  const feedResults = await Promise.allSettled(
    WWR_FEEDS.map(async (feed) => {
      const feedData = await rssParser.parseURL(feed.url);
      return (feedData.items || [])
        .map((item) => normalizeWWRItem(item, feed.category))
        .filter(Boolean);
    })
  );

  const normalizedJobs = [];
  for (const result of feedResults) {
    if (result.status !== 'fulfilled') {
      logger.warn(`WWR RSS feed sync failed: ${result.reason?.message || 'unknown error'}`);
      continue;
    }
    normalizedJobs.push(...result.value);
  }

  return normalizedJobs;
};

const THEMUSE_BASE_URL = 'https://www.themuse.com';
const THEMUSE_JOB_CATEGORIES = [
  'software_engineering',
  'computer_it',
  'data_analytics',
  'design_ux',
  'business_operations',
  'customer_service',
  'project_management',
  'sales',
  'advertising_marketing',
  'human_resources_recruitment',
];
const THEMUSE_CATEGORY_MAP = {
  account_management: 'Sales',
  accounting_finance: 'Finance',
  administration_office: 'Operations',
  advertising_marketing: 'Marketing',
  arts: 'Other',
  business_operations: 'Operations',
  computer_it: 'Software Development',
  customer_service: 'Customer Support',
  data_analytics: 'Data Science',
  design_ux: 'Design',
  education: 'Other',
  healthcare: 'Other',
  human_resources_recruitment: 'Human Resources',
  management: 'Operations',
  media_pr_communications: 'Marketing',
  product_management: 'Project Management',
  project_management: 'Project Management',
  sales: 'Sales',
  software_engineering: 'Software Development',
  writing_editing: 'Writing',
};

const extractTheMuseJobLinks = (html) => {
  const urls = new Set();
  const regex = /href=["']([^"']*\/jobs\/[^"']+)["']/gi;

  for (const match of html.matchAll(regex)) {
    const href = String(match[1] || '').trim();
    if (!href) continue;

    const normalizedUrl = href.startsWith('http')
      ? href
      : `${THEMUSE_BASE_URL}${href.startsWith('/') ? href : `/${href}`}`;

    urls.add(normalizedUrl.replace(/\/+$/, ''));
  }

  return [...urls];
};

const parseTheMuseJobPosting = (html, url) => {
  // Try JSON-LD first
  const match = html.match(/<script[^>]*id=["']job-posting-jsonld["'][^>]*>([\s\S]*?)<\/script>/i);
  if (match) {
    try {
      return JSON.parse(match[1]);
    } catch (error) {
      try {
        const normalized = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
        return JSON.parse(normalized);
      } catch (retryError) {
        logger.warn(`Failed to parse The Muse job posting JSON-LD: ${retryError.message}`);
      }
    }
  }

  // Fallback: extract metadata and page content when JSON-LD isn't present
  try {
    const getMeta = (name) => {
      const m = html.match(new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`, 'i'));
      return m ? String(m[1]).trim() : null;
    };

    const title = getMeta('og:title') || (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1];
    const description = getMeta('og:description') || (html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) || [])[1];
    const companyFromPage = (html.match(/<a[^>]*href=["'][^"']*companies[^"']*["'][^>]*>([\s\S]*?)<\/a>/i) || [])[1]
      || (html.match(/<div[^>]+class=["'][^"']*(company|employer|hiringOrganization)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) || [])[2];

    const hiringOrganization = companyFromPage ? { name: stripHtml(companyFromPage) } : null;

    const datePosted = getMeta('article:published_time') || getMeta('og:updated_time');

    const jobData = {
      title: title ? stripHtml(title) : null,
      hiringOrganization: hiringOrganization || null,
      url: url || getMeta('og:url') || null,
      description: description ? stripHtml(description) : null,
      datePosted: datePosted || null,
      jobLocationType: /remote|telecommute|work from home/i.test(html) ? 'TELECOMMUTE' : undefined,
    };

    // Ensure we return something useful or null
    if (jobData.title && jobData.hiringOrganization && jobData.description) return jobData;
  } catch (err) {
    logger.warn(`The Muse fallback parse failed: ${err.message}`);
  }

  return null;
};

const normalizeTheMuseCategory = (slug) => THEMUSE_CATEGORY_MAP[String(slug || '').trim()] || 'Other';

const isTheMuseRemoteJob = (jobData) => {
  if (!jobData) return false;
  if (jobData.jobLocationType === 'TELECOMMUTE') return true;

  const locationText = `${jobData.jobLocationType || ''} ${jobData.jobLocation || ''} ${jobData.description || ''}`.toLowerCase();
  return /(remote|telecommute|work from home|flexible)/.test(locationText);
};

const fetchTheMuseJobs = async (remoteLimit = 500) => {
  const discoveredUrls = new Set();
  const categoryPageUrls = [];

  for (const categorySlug of THEMUSE_JOB_CATEGORIES) {
    for (let page = 1; page <= 2; page++) {
      const url = page === 1
        ? `${THEMUSE_BASE_URL}/search/category/${categorySlug}/`
        : `${THEMUSE_BASE_URL}/search/category/${categorySlug}/?page=${page}`;
      categoryPageUrls.push({ categorySlug, url });
    }
  }

  for (const { categorySlug, url } of categoryPageUrls) {
    try {
      const pageRes = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const links = extractTheMuseJobLinks(String(pageRes.data || ''));
      for (const jobUrl of links) {
        discoveredUrls.add(jobUrl);
      }
    } catch (error) {
      logger.warn(`The Muse category page sync failed for ${categorySlug}: ${error.message}`);
    }
  }

  const jobs = [];
  for (const jobUrl of [...discoveredUrls]) {
    if (jobs.length >= remoteLimit) break;

    try {
      const detailRes = await axios.get(jobUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const jobData = parseTheMuseJobPosting(String(detailRes.data || ''));

      if (!jobData || !isTheMuseRemoteJob(jobData)) continue;

      const title = String(jobData.title || '').trim();
      const company = String(jobData.hiringOrganization?.name || '').trim();
      const applicationUrl = String(jobData.url || jobUrl).trim();
      const description = stripHtml(jobData.description || '').slice(0, 4000);

      if (!title || !company || !description) continue;

      const externalId = `themuse-${String(jobData.identifier?.value || jobUrl).replace(/^https?:\/\//i, '').replace(/\/+$/, '').replace(/[^a-z0-9]+/gi, '-')}`;
      jobs.push({
        externalId,
        source: 'themuse',
        title,
        company,
        companyLogo: jobData.hiringOrganization?.logo || null,
        category: normalizeTheMuseCategory(jobData.category || jobData.categorySlug || 'software_engineering'),
        jobType: normalizeJobType(Array.isArray(jobData.employmentType) ? jobData.employmentType[0] : jobData.employmentType, 'full-time'),
        location: 'Remote',
        salary: null,
        description,
        tags: ['themuse', normalizeTheMuseCategory(jobData.category || jobData.categorySlug || 'software_engineering').toLowerCase()],
        applicationUrl,
        publishedAt: jobData.datePosted ? new Date(jobData.datePosted) : new Date(),
        isActive: true,
      });
    } catch (error) {
      logger.warn(`The Muse detail sync failed for ${jobUrl}: ${error.message}`);
    }
  }

  return jobs;
};

const formatScrapedSalary = (job) => {
  const min = Number(job.salary_min ?? job.salaryMin) || null;
  const max = Number(job.salary_max ?? job.salaryMax) || null;
  const currency = job.currency || '';
  if (min && max) return `${currency} ${min} - ${max}`.trim();
  if (min) return `${currency} ${min}+`.trim();
  if (max) return `Up to ${currency} ${max}`.trim();
  return null;
};

const stripHtml = (value) => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();

const normalizeRemoteLocation = (location) => {
  const value = String(location || '').trim();
  if (!value) return 'Remote';
  if (/remote/i.test(value)) return 'Remote';
  return value;
};

const inferRemoteOkCategory = (tags = []) => {
  const text = tags.map((tag) => String(tag).toLowerCase()).join(' ');
  if (/(react|node|python|javascript|typescript|java|go|php|developer|engineer|software|backend|frontend|devops|cloud|data|ai|ml|sre|sysadmin)/.test(text)) return 'Software Development';
  if (/(design|figma|ui|ux|graphic|product design|illustrator|brand)/.test(text)) return 'Design';
  if (/(marketing|content|seo|growth|social|copy|brand)/.test(text)) return 'Marketing';
  if (/(support|customer|helpdesk|sales|account|business development)/.test(text)) return 'Customer Support';
  return 'Other';
};

const formatRemoteOkSalary = (job) => {
  const min = Number(job.salary_min);
  const max = Number(job.salary_max);
  if (!min && !max) return null;
  if (min && max && min !== max) return `$${Math.round(min)} - $${Math.round(max)}`;
  if (min) return `$${Math.round(min)}+`;
  if (max) return `Up to $${Math.round(max)}`;
  return null;
};

const inferArbeitnowCategory = (job = {}) => {
  const tags = Array.isArray(job.tags) ? job.tags.map((tag) => String(tag).toLowerCase()) : [];
  const text = `${job.title || ''} ${job.description || ''} ${tags.join(' ')}`.toLowerCase();

  if (/(react|node|python|javascript|typescript|java|go|php|developer|engineer|software|backend|frontend|devops|cloud|data|ai|ml|sre|sysadmin)/.test(text)) return 'Software Development';
  if (/(design|figma|ui|ux|graphic|product design|illustrator|brand)/.test(text)) return 'Design';
  if (/(marketing|content|seo|growth|social|copy|brand)/.test(text)) return 'Marketing';
  if (/(support|customer|helpdesk|sales|account|business development)/.test(text)) return 'Customer Support';
  return 'Other';
};

const inferJSearchCategory = (job = {}) => {
  const text = `${job.job_title || ''} ${job.job_description || ''} ${job.job_employment_type || ''} ${job.job_job_title || ''}`.toLowerCase();
  if (/(react|node|python|javascript|typescript|java|go|php|developer|engineer|software|frontend|backend)/.test(text)) return 'Software Development';
  if (/(devops|cloud|aws|azure|gcp|kubernetes|sre)/.test(text)) return 'DevOps & Cloud';
  if (/(data scientist|machine learning|analytics|data engineer|ai|ml)/.test(text)) return 'Data Science';
  if (/(designer|ui|ux|figma|product design)/.test(text)) return 'Design';
  if (/(marketing|seo|content|growth)/.test(text)) return 'Marketing';
  if (/(support|customer success|helpdesk)/.test(text)) return 'Customer Support';
  if (/(sales|account executive|business development)/.test(text)) return 'Sales';
  return 'Other';
};

const inferCareerjetCategory = (job = {}) => {
  const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  if (/(react|node|python|javascript|typescript|java|go|php|developer|engineer|software|frontend|backend)/.test(text)) return 'Software Development';
  if (/(devops|cloud|aws|azure|gcp|kubernetes|sre)/.test(text)) return 'DevOps & Cloud';
  if (/(data scientist|machine learning|analytics|data engineer|ai|ml)/.test(text)) return 'Data Science';
  if (/(designer|ui|ux|figma|product design)/.test(text)) return 'Design';
  if (/(marketing|seo|content|growth)/.test(text)) return 'Marketing';
  if (/(support|customer success|helpdesk)/.test(text)) return 'Customer Support';
  if (/(sales|account executive|business development)/.test(text)) return 'Sales';
  return 'Other';
};

const formatJSearchSalary = (job = {}) => {
  const min = Number(job.job_min_salary) || null;
  const max = Number(job.job_max_salary) || null;
  const currency = String(job.job_salary_currency || '').trim();
  const period = String(job.job_salary_period || '').trim();
  const suffix = period ? `/${period}` : '';

  if (min && max) return `${currency ? `${currency} ` : ''}${Math.round(min)} - ${Math.round(max)}${suffix}`.trim();
  if (min) return `${currency ? `${currency} ` : ''}${Math.round(min)}+${suffix}`.trim();
  if (max) return `Up to ${currency ? `${currency} ` : ''}${Math.round(max)}${suffix}`.trim();

  const raw = job.job_salary;
  if (typeof raw === 'string' && raw.trim()) return raw.trim().slice(0, 120);
  return null;
};

const inferScrapedCategory = (job) => {
  const tags = Array.isArray(job.tags) ? job.tags.map((tag) => String(tag).toLowerCase()) : [];
  const text = `${job.title || ''} ${job.description || ''} ${tags.join(' ')}`.toLowerCase();
  if (/react|node|python|java|developer|engineer|software|frontend|backend/.test(text)) return 'Software Development';
  if (/devops|cloud|aws|azure|gcp|kubernetes|sre/.test(text)) return 'DevOps & Cloud';
  if (/data scientist|machine learning|analytics|data engineer/.test(text)) return 'Data Science';
  if (/designer|ui|ux|figma|product design/.test(text)) return 'Design';
  if (/marketing|seo|content|growth/.test(text)) return 'Marketing';
  if (/support|customer success|helpdesk/.test(text)) return 'Customer Support';
  if (/sales|account executive|business development/.test(text)) return 'Sales';
  return 'Other';
};

const requireScraperApiKey = (req, res) => {
  const expected = process.env.JOB_SCRAPER_API_KEY || process.env.WEBSITE_API_KEY;
  if (!expected) {
    res.status(503).json({ success: false, message: 'Job scraper API key is not configured' });
    return false;
  }

  const provided = req.get('x-api-key');
  if (provided !== expected) {
    res.status(401).json({ success: false, message: 'Invalid scraper API key' });
    return false;
  }

  return true;
};

// @GET /api/jobs
exports.getJobs = async (req, res) => {
  try {
    const { category, search } = req.query;
    const view = String(req.query.view || 'unique').trim().toLowerCase();
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const now = new Date();

    const query = {
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };
    if (category) query.category = category;
    if (search) query.$text = { $search: search };

    const shouldPrioritizeRemoteSources = !category && !search;
    const useRawFeed = view === 'all';
    const duplicateGroupsOnly = view === 'duplicates';
    const sortStages = shouldPrioritizeRemoteSources
      ? [
          {
            $addFields: {
              sourcePriority: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$source', 'scraper'] }, then: 6 },
                    { case: { $eq: ['$source', 'themuse'] }, then: 5 },
                    { case: { $eq: ['$source', 'weworkremotely'] }, then: 4 },
                    { case: { $eq: ['$source', 'jsearch'] }, then: 3 },
                    { case: { $eq: ['$source', 'careerjet'] }, then: 2 },
                    { case: { $eq: ['$source', 'remoteok'] }, then: 1 },
                    { case: { $eq: ['$source', 'remotive'] }, then: 0 },
                    { case: { $eq: ['$source', 'jooble'] }, then: 0 },
                    { case: { $eq: ['$source', 'jobicy'] }, then: -1 },
                    { case: { $eq: ['$source', 'adzuna'] }, then: -2 },
                  ],
                  default: -3,
                },
              },
            },
          },
        ]
      : [];
    const orderedSort = shouldPrioritizeRemoteSources ? { sourcePriority: -1, publishedAt: -1 } : { publishedAt: -1 };
    const dedupePipeline = useRawFeed
      ? []
      : [
          { $addFields: { duplicateKey: { $concat: [ { $toLower: { $trim: { input: { $ifNull: ['$source', ''] } } } }, '|', { $toLower: { $trim: { input: { $ifNull: ['$title', ''] } } } }, '|', { $toLower: { $trim: { input: { $ifNull: ['$company', ''] } } } }, '|', { $toLower: { $trim: { input: { $ifNull: ['$location', ''] } } } } ] } } },
          {
            $group: {
              _id: '$duplicateKey',
              job: { $first: '$$ROOT' },
              duplicateCount: { $sum: 1 },
              firstPublishedAt: { $first: '$publishedAt' },
            },
          },
          ...(duplicateGroupsOnly ? [{ $match: { duplicateCount: { $gt: 1 } } }] : []),
          {
            $replaceRoot: {
              newRoot: {
                $mergeObjects: [
                  '$job',
                  {
                    duplicateCount: '$duplicateCount',
                    duplicateKey: '$_id',
                  },
                ],
              },
            },
          },
        ];

    const pipeline = [
      { $match: query },
      ...sortStages,
      { $sort: orderedSort },
      ...dedupePipeline,
      ...(!useRawFeed ? [{ $sort: orderedSort }] : []),
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: Number(limit) }],
          meta: [{ $count: 'total' }],
        },
      },
    ];

    const [aggregatedJobs, sourceCounts, scraperStats] = await Promise.all([
      Job.aggregate(pipeline),
      Job.aggregate([
        { $match: { isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] } },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      ['admin', 'superadmin', 'ledger'].includes(req.user?.role || '')
        ? Job.aggregate([
            { $match: { source: 'scraper' } },
            {
              $group: {
                _id: '$source',
                total: { $sum: 1 },
                active: { $sum: { $cond: ['$isActive', 1, 0] } },
                latestPublishedAt: { $max: '$publishedAt' },
                latestUpdatedAt: { $max: '$updatedAt' },
              },
            },
          ])
        : Promise.resolve([]),
    ]);

    const jobs = aggregatedJobs?.[0]?.data || [];
    const total = aggregatedJobs?.[0]?.meta?.[0]?.total || 0;

    const isStaff = ['admin', 'superadmin', 'ledger'].includes(req.user?.role || '');

    res.json({
      success: true,
      jobs,
      sourceCounts: sourceCounts.reduce((acc, item) => {
        acc[item._id || 'unknown'] = item.count;
        return acc;
      }, {}),
      scraperStats: isStaff ? (scraperStats[0] || { total: 0, active: 0, latestPublishedAt: null, latestUpdatedAt: null }) : undefined,
      tokenPolicy: {
        applicationTiers: JOB_APPLICATION_TOKEN_TIERS,
        tokenPackages: TOKEN_PACKAGES,
        postingCost: JOB_POSTING_TOKEN_COST,
      },
      pagination: {
        total,
        page,
        limit,
        pages: Math.max(Math.ceil(total / limit), 1),
        hasNextPage: skip + jobs.length < total,
        hasPrevPage: page > 1,
      },
      view: useRawFeed ? 'all' : duplicateGroupsOnly ? 'duplicates' : 'unique',
    });
  } catch (error) {
    logger.error(`getJobs error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/jobs
exports.createJobPosting = async (req, res) => {
  try {
    const user = req.user;
    if (!user.activationStatus) {
      return res.status(403).json({ success: false, message: 'Activation required to post jobs' });
    }

    if ((user.tokenBalance || 0) < JOB_POSTING_TOKEN_COST) {
      return res.status(400).json({
        success: false,
        message: `Posting one job requires ${JOB_POSTING_TOKEN_COST} tokens`,
        tokenBalance: user.tokenBalance || 0,
      });
    }

    const {
      title,
      company,
      category,
      categoryOther,
      jobType,
      location,
      salary,
      description,
      applicationUrl,
      tags = [],
      budgetAmount,
      budgetCurrency = 'KES',
    } = req.body;

    if (!title || !company || !category || !description || !applicationUrl) {
      return res.status(400).json({ success: false, message: 'Missing required job posting fields' });
    }

    const normalizedCategory = String(category || '').trim();
    let normalizedCategoryOther = null;
    if (normalizedCategory === 'Other') {
      normalizedCategoryOther = String(categoryOther || '').trim();
      if (normalizedCategoryOther.length < 3 || normalizedCategoryOther.length > 60) {
        return res.status(400).json({
          success: false,
          message: 'Please specify Other category using 3 to 60 characters',
        });
      }
    }

    const normalizedBudget = Number(budgetAmount) || 0;
    const applicationTokenCost = getApplicationTokenCost(normalizedBudget);
    const publishedAt = new Date();
    user.consumeTokens(JOB_POSTING_TOKEN_COST);
    await user.save();

    const job = await Job.create({
      externalId: `internal-${Date.now()}-${user.userId}`,
      source: 'internal',
      title,
      company,
      category: normalizedCategory,
      categoryOther: normalizedCategoryOther,
      jobType: jobType || 'contract',
      location: location || 'Remote',
      salary: salary || null,
      description,
      tags,
      applicationUrl,
      postedBy: user._id,
      budgetAmount: normalizedBudget || null,
      budgetCurrency,
      postingTokenCost: JOB_POSTING_TOKEN_COST,
      applicationTokenCost,
      publishedAt,
      expiresAt: null,
      isActive: true,
    });

    await Transaction.create({
      userId: user._id,
      type: 'job_posting',
      amountLocal: JOB_POSTING_TOKEN_COST,
      amountUSD: 0,
      currency: 'TOKEN',
      country: user.country,
      provider: 'internal',
      direction: 'debit',
      status: 'successful',
      processedAt: new Date(),
      metadata: {
        jobId: job._id.toString(),
        tokensSpent: JOB_POSTING_TOKEN_COST,
      },
    });

    res.status(201).json({
      success: true,
      job,
      tokenBalance: user.tokenBalance,
      tokensSpent: JOB_POSTING_TOKEN_COST,
    });
  } catch (error) {
    logger.error(`createJobPosting error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/jobs/categories
exports.getCategories = async (req, res) => {
  try {
    const now = new Date();
    const categories = await Job.distinct('category', {
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });
    const normalized = (categories || []).filter(Boolean);
    const merged = [...new Set([...DEFAULT_JOB_CATEGORIES, ...normalized])];
    return res.json({ success: true, categories: merged });
  } catch (error) {
    logger.error(`getCategories error: ${error.message}`);
    return res.json({
      success: true,
      categories: DEFAULT_JOB_CATEGORIES,
      fallback: true,
    });
  }
};

// @GET /api/jobs/:id
exports.getJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job || !job.isActive || (job.expiresAt && job.expiresAt <= new Date())) {
      return res.status(404).json({ success: false, message: 'Job not found' });
    }

    const canManageApplications =
      ['admin', 'superadmin'].includes(String(req.user.role || '')) ||
      (job.postedBy && String(job.postedBy) === String(req.user.id));

    const [userApplication, applications] = await Promise.all([
      JobApplication.findOne({
        jobId: job._id,
        userId: req.user.id,
      }).select('status appliedAt createdAt updatedAt tokenCost applicantEmailSent reminder24At reminder7At redirectedAt appliedConfirmedAt'),
      canManageApplications
        ? JobApplication.find({ jobId: job._id })
            .sort({ createdAt: -1 })
            .populate({
              path: 'userId',
              select: 'firstName lastName name email phone userId',
            })
            .select('status appliedAt createdAt updatedAt tokenCost coverLetter userId applicantEmailSent reminder24At reminder7At redirectedAt appliedConfirmedAt')
        : Promise.resolve([]),
    ]);

    job.views += 1;
    await job.save();

    const normalizedUserApplication = userApplication
      ? {
          ...userApplication.toObject(),
          status: normalizeJobApplicationStatus(userApplication.status),
        }
      : null;

    const normalizedApplications = canManageApplications
      ? applications.map((application) => {
          const applicant = application.userId || {};
      return {
        _id: application._id,
        status: normalizeJobApplicationStatus(application.status),
        appliedAt: application.appliedAt,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        tokenCost: application.tokenCost || 0,
        coverLetter: application.coverLetter || '',
        applicantEmailSent: Boolean(application.applicantEmailSent),
        reminder24At: application.reminder24At,
        reminder7At: application.reminder7At,
        applicant: {
              id: applicant._id,
              userId: applicant.userId,
              firstName: applicant.firstName,
              lastName: applicant.lastName,
              name: applicant.name,
              email: applicant.email,
              phone: applicant.phone,
            },
          };
        })
      : [];

    res.json({
      success: true,
      job,
      userApplication: normalizedUserApplication,
      canManageApplications,
      applications: normalizedApplications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @PATCH /api/jobs/:id/claim
exports.claimJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    // Only allow claiming scraped jobs or allow owner/admin to update
    const isOwner = job.postedBy && String(job.postedBy) === String(req.user.id);
    const isAdmin = ['admin', 'superadmin'].includes(String(req.user.role || ''));

    if (job.postedBy && !isOwner && !isAdmin) {
      return res.status(403).json({ success: false, message: 'Not allowed to claim or update this job' });
    }

    const { applicationDelivery, employerWebhookUrl, employerEmail } = req.body || {};

    if (applicationDelivery && !['redirect', 'webhook', 'email', 'internal'].includes(applicationDelivery)) {
      return res.status(400).json({ success: false, message: 'Invalid applicationDelivery value' });
    }

    // Claim the job (assign postedBy) if it was unclaimed
    if (!job.postedBy) {
      job.postedBy = req.user._id;
    }

    if (typeof applicationDelivery === 'string') job.applicationDelivery = applicationDelivery;
    if (typeof employerWebhookUrl === 'string') job.employerWebhookUrl = employerWebhookUrl || null;
    if (typeof employerEmail === 'string') job.employerEmail = employerEmail || null;

    await job.save();

    return res.json({ success: true, job });
  } catch (error) {
    logger.error(`claimJob error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/jobs/:id/request-claim
exports.requestClaim = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id).select('_id title company applicationUrl');
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'Valid email required' });
    }

    const ClaimRequest = require('../models/ClaimRequest');
    const crypto = require('crypto');
    const token = crypto.randomBytes(20).toString('hex');

    const claim = await ClaimRequest.create({ jobId: job._id, email, token });

    // Send verification email
    const { sendgridClient } = require('../services/notificationService');
    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
    const confirmUrl = `${frontendUrl.replace(/\/$/, '')}/jobs/claim/confirm?token=${encodeURIComponent(token)}`;
    const subject = `Confirm ownership of job: ${job.title}`;
    const html = `
      <p>Hello,</p>
      <p>To claim the job <strong>${job.title}</strong> at <strong>${job.company}</strong> and receive collected applications, please confirm your email by clicking the link below:</p>
      <p><a href="${confirmUrl}">Claim this job</a></p>
      <p>This link will expire in 24 hours.</p>
    `;

    try {
      await sendgridClient.sendEmail({ to: email, subject, html });
    } catch (err) {
      // ignore email failures but log
      logger.warn(`Failed to send claim confirmation email to ${email}: ${err.message}`);
    }

    return res.json({ success: true, message: 'Verification email sent if address is valid' });
  } catch (error) {
    logger.error(`requestClaim error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/jobs/claim/confirm?token=...
exports.confirmClaim = async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    if (!token) return res.status(400).json({ success: false, message: 'Token required' });

    const ClaimRequest = require('../models/ClaimRequest');
    const claim = await ClaimRequest.findOne({ token });
    if (!claim) return res.status(404).json({ success: false, message: 'Invalid or expired token' });
    if (claim.status !== 'pending' || claim.expiresAt <= new Date()) {
      claim.status = 'expired';
      await claim.save();
      return res.status(400).json({ success: false, message: 'Token expired' });
    }

    const job = await Job.findById(claim.jobId);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });

    // mark job to deliver applications via email
    job.applicationDelivery = 'email';
    job.employerEmail = claim.email;
    job.claimedBy = null;
    await job.save();

    claim.status = 'confirmed';
    await claim.save();

    // Enqueue existing applications for delivery
    const JobApplication = require('../models/JobApplication');
    const Delivery = require('../models/Delivery');
    const { publishToQueue, QUEUES } = require('../services/queueWorker');

    const applications = await JobApplication.find({ jobId: job._id }).lean();
    for (const app of applications) {
      const payload = {
        applicationId: app._id.toString(),
        jobId: job._id.toString(),
        jobTitle: job.title,
        company: job.company,
        applicant: app.userId || null,
        coverLetter: app.coverLetter || null,
        appliedAt: app.appliedAt || app.createdAt,
        applicationUrl: job.applicationUrl,
      };

      const delivery = await Delivery.create({
        jobApplicationId: app._id,
        jobId: job._id,
        deliveryType: 'email',
        emailAddress: claim.email,
        payload,
        attempts: 0,
        status: 'pending',
        nextAttemptAt: new Date(),
      });

      publishToQueue(QUEUES.JOB_APPLICATION_DELIVERY, { deliveryId: delivery._id.toString() });
    }

    // Redirect to a simple confirmation UI on frontend
    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:3000';
    return res.redirect(`${frontendUrl.replace(/\/$/, '')}/jobs/claim/success`);
  } catch (error) {
    logger.error(`confirmClaim error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/jobs/sync
exports.syncScrapedJob = async (req, res) => {
  try {
    if (!requireScraperApiKey(req, res)) return;

    const scraped = req.body || {};
    const hash = scraped.hash || scraped.id;
    const applicationUrl = scraped.apply_url || scraped.applyUrl || scraped.source_url || scraped.sourceUrl;
    const title = String(scraped.title || '').trim();
    const company = String(scraped.company || 'Unknown company').trim();
    const description = String(scraped.description || '').trim();

    if (!hash || !title || !description || !applicationUrl) {
      return res.status(400).json({ success: false, message: 'Missing required scraped job fields' });
    }

    const contact = discoverApplicationContact({
      title,
      company,
      description,
      applicationUrl,
      source: 'scraper',
      extraText: scraped.sourceUrl || scraped.source_url || '',
    });

    const job = await Job.findOneAndUpdate(
      { externalId: `scraper-${hash}` },
      {
        externalId: `scraper-${hash}`,
        source: 'scraper',
        title,
        company,
        companyLogo: null,
        category: inferScrapedCategory(scraped),
        categoryOther: null,
        jobType: normalizeJobType(scraped.employment_type || scraped.employmentType, 'full-time'),
        location: scraped.remote ? 'Remote' : (scraped.location || 'Remote'),
        salary: formatScrapedSalary(scraped),
        description: description.slice(0, 10000),
        tags: Array.isArray(scraped.tags) ? scraped.tags.slice(0, 20) : [],
        applicationUrl,
        applicationContactEmail: contact.applicationContactEmail,
        applicationContactSource: contact.applicationContactSource,
        collectOnly: !contact.applicationContactEmail,
        postedBy: null,
        budgetAmount: null,
        budgetCurrency: null,
        postingTokenCost: 0,
        applicationTokenCost: 0,
        expiresAt: null,
        publishedAt: scraped.posted_at || scraped.postedAt ? new Date(scraped.posted_at || scraped.postedAt) : new Date(),
        isActive: scraped.is_active !== false && scraped.isActive !== false,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({ success: true, job });
  } catch (error) {
    logger.error(`syncScrapedJob error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @POST /api/jobs/expire
exports.expireScrapedJobs = async (req, res) => {
  try {
    if (!requireScraperApiKey(req, res)) return;

    const hoursWithoutSeen = Math.min(Math.max(Number(req.body?.hoursWithoutSeen) || 72, 1), 720);
    const cutoff = new Date(Date.now() - hoursWithoutSeen * 60 * 60 * 1000);
    const result = await Job.updateMany(
      { source: 'scraper', updatedAt: { $lt: cutoff } },
      { $set: { isActive: false } }
    );

    return res.json({ success: true, expired: result.modifiedCount || 0 });
  } catch (error) {
    logger.error(`expireScrapedJobs error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Called by cron scheduler every 6 hours
exports.syncJobs = async () => {
  logger.info('Syncing remote jobs...');
  let synced = 0;
  const remoteLimit = Math.min(Math.max(Number(process.env.REMOTE_JOB_SYNC_LIMIT || 500), 10), 5000);
  const providerStats = {
    remotive: { synced: 0, status: 'pending' },
    jobicy: { synced: 0, status: 'pending' },
    remoteok: { synced: 0, status: 'pending' },
    arbeitnow: { synced: 0, status: 'pending' },
    weworkremotely: { synced: 0, status: 'pending' },
    themuse: { synced: 0, status: 'pending' },
    jsearch: { synced: 0, status: 'pending' },
    careerjet: { synced: 0, status: 'pending' },
    jooble: { synced: 0, status: 'pending' },
    adzuna: { synced: 0, status: 'pending' },
  };

  try {
    // Remotive
    try {
      const remotiveRes = await axios.get(process.env.REMOTIVE_API_URL || 'https://remotive.com/api/remote-jobs', {
        timeout: 10000,
      });
      const remotiveJobs = remotiveRes.data?.jobs || [];

      const remotiveOps = [];
      for (const job of remotiveJobs.slice(0, remoteLimit)) {
        const contact = discoverApplicationContact({
          title: job.title,
          company: job.company_name,
          description: job.description || '',
          applicationUrl: job.url || '',
          source: 'remotive',
        });

        remotiveOps.push({
          updateOne: {
            filter: { externalId: `remotive-${job.id}` },
            update: {
              $set: {
                externalId: `remotive-${job.id}`,
                source: 'remotive',
                title: job.title,
                company: job.company_name,
                companyLogo: job.company_logo,
                category: job.category || 'Other',
                jobType: normalizeJobType(job.job_type),
                location: 'Remote',
                salary: job.salary || null,
                description: job.description?.slice(0, 2000) || '',
                tags: job.tags || [],
                applicationUrl: job.url,
                applicationContactEmail: contact.applicationContactEmail,
                applicationContactSource: contact.applicationContactSource,
                collectOnly: !contact.applicationContactEmail,
                publishedAt: new Date(job.publication_date),
                isActive: true,
              },
            },
            upsert: true,
          },
        });
      }
    

    // Jobicy
    try {
      const jobicyRes = await axios.get(process.env.JOBICY_API_URL || 'https://jobicy.com/api/v2/remote-jobs', {
        timeout: 10000,
      });
      const jobicyJobs = jobicyRes.data?.jobs || [];

      for (const job of jobicyJobs.slice(0, remoteLimit)) {
        const contact = discoverApplicationContact({
          title: job.jobTitle,
          company: job.companyName,
          description: job.jobDescription || '',
          applicationUrl: job.url || '',
          source: 'jobicy',
        });

        await Job.findOneAndUpdate(
          { externalId: `jobicy-${job.id}` },
          {
            externalId: `jobicy-${job.id}`,
            source: 'jobicy',
            title: job.jobTitle,
            company: job.companyName,
            companyLogo: job.companyLogo || null,
            category: job.jobIndustry?.[0] || 'Other',
            jobType: normalizeJobType(job.jobType),
            location: 'Remote',
            salary: job.annualSalaryMin ? `$${job.annualSalaryMin} - $${job.annualSalaryMax}` : null,
            description: job.jobDescription?.slice(0, 2000) || '',
            tags: job.jobLevel ? [job.jobLevel] : [],
            applicationUrl: job.url,
            applicationContactEmail: contact.applicationContactEmail,
            applicationContactSource: contact.applicationContactSource,
            collectOnly: !contact.applicationContactEmail,
            publishedAt: new Date(job.pubDate),
            isActive: true,
          },
          { upsert: true, new: true }
        );
        synced++;
        providerStats.jobicy.synced++;
      }
      providerStats.jobicy.status = 'ok';
    } catch (jobicyError) {
      providerStats.jobicy.status = 'failed';
      providerStats.jobicy.error = jobicyError.message;
      logger.warn(`Jobicy sync skipped: ${jobicyError.message}`);
    }

    // Remote OK
    try {
      const remoteOkRes = await axios.get('https://remoteok.com/api', {
        timeout: 10000,
      });
      const remoteOkJobs = Array.isArray(remoteOkRes.data) ? remoteOkRes.data.slice(1) : [];

      for (const job of remoteOkJobs.slice(0, remoteLimit)) {
        const applicationUrl = String(job.apply_url || job.url || '').trim();
        if (!applicationUrl || !job.id) continue;

        const contact = discoverApplicationContact({
          title: job.position || '',
          company: job.company || '',
          description: job.description || '',
          applicationUrl,
          source: 'remoteok',
        });

        const title = String(job.position || 'Remote role').trim();
        const company = String(job.company || 'Unknown company').trim();
        const remoteTags = Array.isArray(job.tags) ? job.tags.map((tag) => String(tag).trim()).filter(Boolean) : [];
        const location = normalizeRemoteLocation(job.location);
        const description = stripHtml(job.description || '').slice(0, 4000);

        await Job.findOneAndUpdate(
          { externalId: `remoteok-${job.id}` },
          {
            externalId: `remoteok-${job.id}`,
            source: 'remoteok',
            title,
            company,
            companyLogo: job.company_logo || job.logo || null,
            category: inferRemoteOkCategory(remoteTags),
            jobType: normalizeJobType(job.type || 'full-time'),
            location,
            salary: formatRemoteOkSalary(job),
            description,
            tags: remoteTags,
            applicationUrl,
            applicationContactEmail: contact.applicationContactEmail,
            applicationContactSource: contact.applicationContactSource,
            collectOnly: !contact.applicationContactEmail,
            publishedAt: job.date ? new Date(job.date) : new Date(job.epoch * 1000 || Date.now()),
            isActive: true,
          },
          { upsert: true, new: true }
        );
        synced++;
        providerStats.remoteok.synced++;
      }
      providerStats.remoteok.status = 'ok';
    } catch (remoteOkError) {
      providerStats.remoteok.status = 'failed';
      providerStats.remoteok.error = remoteOkError.message;
      logger.warn(`RemoteOK sync skipped: ${remoteOkError.message}`);
    }

    // Arbeitnow
    try {
      const arbeitnowBaseUrl = (process.env.ARBEITNOW_API_URL || 'https://www.arbeitnow.com/api/job-board-api').replace(/\/+$/, '');
      const arbeitnowMaxPages = Math.min(Math.max(Number(process.env.ARBEITNOW_MAX_PAGES || 10), 1), 30);

      let page = 1;
      let seen = 0;
      while (page <= arbeitnowMaxPages && seen < remoteLimit) {
        const arbeitnowRes = await axios.get(arbeitnowBaseUrl, { timeout: 12000, params: { page } });
        const pageJobs = Array.isArray(arbeitnowRes.data?.data) ? arbeitnowRes.data.data : [];
        if (pageJobs.length === 0) break;

        const ops = [];
        for (const job of pageJobs) {
          if (job?.remote !== true) continue;
          if (seen >= remoteLimit) break;

          const applicationUrl = String(job.url || '').trim();
          const slug = String(job.slug || '').trim();
          if (!applicationUrl || !slug) continue;

          const contact = discoverApplicationContact({
            title: job.title || '',
            company: job.company_name || '',
            description: job.description || '',
            applicationUrl,
            source: 'arbeitnow',
          });

          ops.push({
            updateOne: {
              filter: { externalId: `arbeitnow-${slug}` },
              update: {
                $set: {
                  externalId: `arbeitnow-${slug}`,
                  source: 'arbeitnow',
                  title: String(job.title || 'Remote role').trim(),
                  company: String(job.company_name || 'Unknown company').trim(),
                  companyLogo: null,
                  category: inferArbeitnowCategory(job),
                  categoryOther: null,
                  jobType: normalizeJobType(job.job_types || ['full-time']),
                  location: normalizeRemoteLocation(job.location),
                  salary: null,
                  description: stripHtml(job.description || '').slice(0, 4000),
                  tags: Array.isArray(job.tags) ? job.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
                  applicationUrl,
                  applicationContactEmail: contact.applicationContactEmail,
                  applicationContactSource: contact.applicationContactSource,
                  collectOnly: !contact.applicationContactEmail,
                  publishedAt: job.created_at ? new Date(job.created_at) : new Date(),
                  isActive: true,
                },
              },
              upsert: true,
            },
          });
          seen += 1;
        }

        if (ops.length > 0) {
          await Job.bulkWrite(ops, { ordered: false });
          synced += ops.length;
          providerStats.arbeitnow.synced += ops.length;
        }

        // Stop early if the API indicates there's no next page.
        const next = arbeitnowRes.data?.links?.next;
        if (!next) break;
        page += 1;
      }
      providerStats.arbeitnow.status = 'ok';
    } catch (arbeitnowError) {
      providerStats.arbeitnow.status = 'failed';
      providerStats.arbeitnow.error = arbeitnowError.message;
      logger.warn(`Arbeitnow sync skipped: ${arbeitnowError.message}`);
    }

    // We Work Remotely (RSS)
    try {
      const wwrJobs = await fetchWWRJobs();
      for (const job of wwrJobs.slice(0, remoteLimit)) {
        const contact = discoverApplicationContact({
          title: job.title,
          company: job.company,
          description: job.description,
          applicationUrl: job.applicationUrl,
          source: 'weworkremotely',
        });

        await Job.findOneAndUpdate(
          { externalId: job.externalId },
          {
            externalId: job.externalId,
            source: 'weworkremotely',
            title: job.title,
            company: job.company,
            companyLogo: null,
            category: job.category,
            jobType: 'full-time',
            location: 'Remote',
            salary: null,
            description: job.description,
            tags: job.tags,
            applicationUrl: job.applicationUrl,
            applicationContactEmail: contact.applicationContactEmail,
            applicationContactSource: contact.applicationContactSource,
            collectOnly: !contact.applicationContactEmail,
            publishedAt: job.publishedAt,
            isActive: true,
          },
          { upsert: true, new: true }
        );
        synced++;
        providerStats.weworkremotely.synced++;
      }
      providerStats.weworkremotely.status = 'ok';
    } catch (wwrError) {
      providerStats.weworkremotely.status = 'failed';
      providerStats.weworkremotely.error = wwrError.message;
      logger.warn(`WWR sync skipped: ${wwrError.message}`);
    }

    // The Muse
    try {
      const museJobs = await fetchTheMuseJobs(remoteLimit);
      for (const job of museJobs) {
        const contact = discoverApplicationContact({
          title: job.title,
          company: job.company,
          description: job.description,
          applicationUrl: job.applicationUrl,
          source: 'themuse',
        });

        await Job.findOneAndUpdate(
          { externalId: job.externalId },
          {
            externalId: job.externalId,
            source: job.source,
            title: job.title,
            company: job.company,
            companyLogo: job.companyLogo,
            category: job.category,
            jobType: job.jobType,
            location: job.location,
            salary: job.salary,
            description: job.description,
            tags: job.tags,
            applicationUrl: job.applicationUrl,
            applicationContactEmail: contact.applicationContactEmail,
            applicationContactSource: contact.applicationContactSource,
            collectOnly: !contact.applicationContactEmail,
            publishedAt: job.publishedAt,
            isActive: true,
          },
          { upsert: true, new: true }
        );
        synced++;
        providerStats.themuse.synced++;
      }
      providerStats.themuse.status = 'ok';
    } catch (themuseError) {
      providerStats.themuse.status = 'failed';
      providerStats.themuse.error = themuseError.message;
      logger.warn(`The Muse sync skipped: ${themuseError.message}`);
    }
    
      if (remotiveOps.length > 0) {
        await Job.bulkWrite(remotiveOps, { ordered: false });
        synced += remotiveOps.length;
        providerStats.remotive.synced += remotiveOps.length;
      }
      providerStats.remotive.status = 'ok';
    } catch (remotiveError) {
      providerStats.remotive.status = 'failed';
      providerStats.remotive.error = remotiveError.message;
      logger.warn(`Remotive sync skipped: ${remotiveError.message}`);
    }

    // Jobicy
    try {
      const jobicyRes = await axios.get(process.env.JOBICY_API_URL || 'https://jobicy.com/api/v2/remote-jobs', {
        timeout: 10000,
      });
      const jobicyJobs = jobicyRes.data?.jobs || [];

      for (const job of jobicyJobs.slice(0, remoteLimit)) {
        const contact = discoverApplicationContact({
          title: job.jobTitle,
          company: job.companyName,
          description: job.jobDescription || '',
          applicationUrl: job.url || '',
          source: 'jobicy',
        });

        await Job.findOneAndUpdate(
          { externalId: `jobicy-${job.id}` },
          {
            externalId: `jobicy-${job.id}`,
            source: 'jobicy',
            title: job.jobTitle,
            company: job.companyName,
            companyLogo: job.companyLogo || null,
            category: job.jobIndustry?.[0] || 'Other',
            jobType: normalizeJobType(job.jobType),
            location: 'Remote',
            salary: job.annualSalaryMin ? `$${job.annualSalaryMin} - $${job.annualSalaryMax}` : null,
            description: job.jobDescription?.slice(0, 2000) || '',
            tags: job.jobLevel ? [job.jobLevel] : [],
            applicationUrl: job.url,
            applicationContactEmail: contact.applicationContactEmail,
            applicationContactSource: contact.applicationContactSource,
            publishedAt: new Date(job.pubDate),
            isActive: true,
          },
          { upsert: true, new: true }
        );
        synced++;
        providerStats.jobicy.synced++;
      }
      providerStats.jobicy.status = 'ok';
    } catch (jobicyError) {
      providerStats.jobicy.status = 'failed';
      providerStats.jobicy.error = jobicyError.message;
      logger.warn(`Jobicy sync skipped: ${jobicyError.message}`);
    }

    // Remote OK
    try {
      const remoteOkRes = await axios.get('https://remoteok.com/api', {
        timeout: 10000,
      });
      const remoteOkJobs = Array.isArray(remoteOkRes.data) ? remoteOkRes.data.slice(1) : [];

      for (const job of remoteOkJobs.slice(0, remoteLimit)) {
        const applicationUrl = String(job.apply_url || job.url || '').trim();
        if (!applicationUrl || !job.id) continue;

        const contact = discoverApplicationContact({
          title: job.position || '',
          company: job.company || '',
          description: job.description || '',
          applicationUrl,
          source: 'remoteok',
        });

        const title = String(job.position || 'Remote role').trim();
        const company = String(job.company || 'Unknown company').trim();
        const remoteTags = Array.isArray(job.tags) ? job.tags.map((tag) => String(tag).trim()).filter(Boolean) : [];
        const location = normalizeRemoteLocation(job.location);
        const description = stripHtml(job.description || '').slice(0, 4000);

        await Job.findOneAndUpdate(
          { externalId: `remoteok-${job.id}` },
          {
            externalId: `remoteok-${job.id}`,
            source: 'remoteok',
            title,
            company,
            companyLogo: job.company_logo || job.logo || null,
            category: inferRemoteOkCategory(remoteTags),
            jobType: normalizeJobType(job.type || 'full-time'),
            location,
            salary: formatRemoteOkSalary(job),
            description,
            tags: remoteTags,
            applicationUrl,
            applicationContactEmail: contact.applicationContactEmail,
            applicationContactSource: contact.applicationContactSource,
            publishedAt: job.date ? new Date(job.date) : new Date(job.epoch * 1000 || Date.now()),
            isActive: true,
          },
          { upsert: true, new: true }
        );
        synced++;
        providerStats.remoteok.synced++;
      }
      providerStats.remoteok.status = 'ok';
    } catch (remoteOkError) {
      providerStats.remoteok.status = 'failed';
      providerStats.remoteok.error = remoteOkError.message;
      logger.warn(`RemoteOK sync skipped: ${remoteOkError.message}`);
    }

    // Arbeitnow
    try {
      const arbeitnowBaseUrl = (process.env.ARBEITNOW_API_URL || 'https://www.arbeitnow.com/api/job-board-api').replace(/\/+$/, '');
      const arbeitnowMaxPages = Math.min(Math.max(Number(process.env.ARBEITNOW_MAX_PAGES || 10), 1), 30);

      let page = 1;
      let seen = 0;
      while (page <= arbeitnowMaxPages && seen < remoteLimit) {
        const arbeitnowRes = await axios.get(arbeitnowBaseUrl, { timeout: 12000, params: { page } });
        const pageJobs = Array.isArray(arbeitnowRes.data?.data) ? arbeitnowRes.data.data : [];
        if (pageJobs.length === 0) break;

        const ops = [];
        for (const job of pageJobs) {
          if (job?.remote !== true) continue;
          if (seen >= remoteLimit) break;

          const applicationUrl = String(job.url || '').trim();
          const slug = String(job.slug || '').trim();
          if (!applicationUrl || !slug) continue;

          const contact = discoverApplicationContact({
            title: job.title || '',
            company: job.company_name || '',
            description: job.description || '',
            applicationUrl,
            source: 'arbeitnow',
          });

          ops.push({
            updateOne: {
              filter: { externalId: `arbeitnow-${slug}` },
              update: {
                $set: {
                  externalId: `arbeitnow-${slug}`,
                  source: 'arbeitnow',
                  title: String(job.title || 'Remote role').trim(),
                  company: String(job.company_name || 'Unknown company').trim(),
                  companyLogo: null,
                  category: inferArbeitnowCategory(job),
                  categoryOther: null,
                  jobType: normalizeJobType(job.job_types || ['full-time']),
                  location: normalizeRemoteLocation(job.location),
                  salary: null,
                  description: stripHtml(job.description || '').slice(0, 4000),
                  tags: Array.isArray(job.tags) ? job.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
                  applicationUrl,
                  applicationContactEmail: contact.applicationContactEmail,
                  applicationContactSource: contact.applicationContactSource,
                  publishedAt: job.created_at ? new Date(job.created_at) : new Date(),
                  isActive: true,
                },
              },
              upsert: true,
            },
          });
          seen += 1;
        }

        if (ops.length > 0) {
          await Job.bulkWrite(ops, { ordered: false });
          synced += ops.length;
          providerStats.arbeitnow.synced += ops.length;
        }

        // Stop early if the API indicates there's no next page.
        const next = arbeitnowRes.data?.links?.next;
        if (!next) break;
        page += 1;
      }
      providerStats.arbeitnow.status = 'ok';
    } catch (arbeitnowError) {
      providerStats.arbeitnow.status = 'failed';
      providerStats.arbeitnow.error = arbeitnowError.message;
      logger.warn(`Arbeitnow sync skipped: ${arbeitnowError.message}`);
    }

    // We Work Remotely (RSS)
    try {
      const wwrJobs = await fetchWWRJobs();
      for (const job of wwrJobs.slice(0, remoteLimit)) {
        const contact = discoverApplicationContact({
          title: job.title,
          company: job.company,
          description: job.description,
          applicationUrl: job.applicationUrl,
          source: 'weworkremotely',
        });

        await Job.findOneAndUpdate(
          { externalId: job.externalId },
          {
            externalId: job.externalId,
            source: 'weworkremotely',
            title: job.title,
            company: job.company,
            companyLogo: null,
            category: job.category,
            jobType: 'full-time',
            location: 'Remote',
            salary: null,
            description: job.description,
            tags: job.tags,
            applicationUrl: job.applicationUrl,
            applicationContactEmail: contact.applicationContactEmail,
            applicationContactSource: contact.applicationContactSource,
            publishedAt: job.publishedAt,
            isActive: true,
          },
          { upsert: true, new: true }
        );
        synced++;
        providerStats.weworkremotely.synced++;
      }
      providerStats.weworkremotely.status = 'ok';
    } catch (wwrError) {
      providerStats.weworkremotely.status = 'failed';
      providerStats.weworkremotely.error = wwrError.message;
      logger.warn(`WWR sync skipped: ${wwrError.message}`);
    }

    // The Muse
    try {
      const museJobs = await fetchTheMuseJobs(remoteLimit);
      for (const job of museJobs) {
        const contact = discoverApplicationContact({
          title: job.title,
          company: job.company,
          description: job.description,
          applicationUrl: job.applicationUrl,
          source: 'themuse',
        });

        await Job.findOneAndUpdate(
          { externalId: job.externalId },
          {
            externalId: job.externalId,
            source: job.source,
            title: job.title,
            company: job.company,
            companyLogo: job.companyLogo,
            category: job.category,
            jobType: job.jobType,
            location: job.location,
            salary: job.salary,
            description: job.description,
            tags: job.tags,
            applicationUrl: job.applicationUrl,
            applicationContactEmail: contact.applicationContactEmail,
            applicationContactSource: contact.applicationContactSource,
            publishedAt: job.publishedAt,
            isActive: true,
          },
          { upsert: true, new: true }
        );
        synced++;
        providerStats.themuse.synced++;
      }
      providerStats.themuse.status = 'ok';
    } catch (themuseError) {
      providerStats.themuse.status = 'failed';
      providerStats.themuse.error = themuseError.message;
      logger.warn(`The Muse sync skipped: ${themuseError.message}`);
    }

    // JSearch via RapidAPI (optional, enabled when RAPIDAPI_KEY is configured)
    if (process.env.RAPIDAPI_KEY) {
      try {
        const jsearchApiUrl = process.env.JSEARCH_API_URL || 'https://jsearch.p.rapidapi.com/search';
        const jsearchQuery = process.env.JSEARCH_QUERY || 'remote software engineer';
        const jsearchMaxPages = Math.min(Math.max(Number(process.env.JSEARCH_MAX_PAGES || 3), 1), 10);
        const jsearchPageSize = Math.min(Math.max(Number(process.env.JSEARCH_PAGE_SIZE || 20), 1), 50);
        let seen = 0;

        for (let page = 1; page <= jsearchMaxPages && seen < remoteLimit; page++) {
          const jsearchRes = await axios.get(jsearchApiUrl, {
            timeout: 12000,
            headers: {
              'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
              'X-RapidAPI-Host': process.env.JSEARCH_API_HOST || 'jsearch.p.rapidapi.com',
            },
            params: {
              query: jsearchQuery,
              page: String(page),
              num_pages: '1',
              remote_jobs_only: 'true',
              date_posted: process.env.JSEARCH_DATE_POSTED || 'all',
            },
          });

          const jobs = Array.isArray(jsearchRes.data?.data) ? jsearchRes.data.data : [];
          if (jobs.length === 0) break;

          const ops = [];
          for (const job of jobs.slice(0, jsearchPageSize)) {
            if (seen >= remoteLimit) break;

            const applicationUrl = String(job.job_apply_link || job.job_google_link || '').trim();
            const externalIdRaw = String(job.job_id || job.job_offer_expiration_datetime_utc || applicationUrl).trim();
            if (!applicationUrl || !externalIdRaw) continue;

            const contact = discoverApplicationContact({
              title: job.job_title || '',
              company: job.employer_name || '',
              description: job.job_description || '',
              applicationUrl,
              source: 'jsearch',
            });

            ops.push({
              updateOne: {
                filter: { externalId: `jsearch-${externalIdRaw}` },
                update: {
                  $set: {
                    externalId: `jsearch-${externalIdRaw}`,
                    source: 'jsearch',
                    title: String(job.job_title || 'Remote role').trim(),
                    company: String(job.employer_name || 'Unknown company').trim(),
                    companyLogo: job.employer_logo || null,
                    category: inferJSearchCategory(job),
                    categoryOther: null,
                    jobType: normalizeJobType(job.job_employment_type, 'full-time'),
                    location: 'Remote',
                    salary: formatJSearchSalary(job),
                    description: stripHtml(job.job_description || '').slice(0, 4000),
                    tags: ['jsearch', ...(Array.isArray(job.job_required_skills) ? job.job_required_skills.slice(0, 10).map((s) => String(s).trim()).filter(Boolean) : [])],
                    applicationUrl,
                    applicationContactEmail: contact.applicationContactEmail,
                    applicationContactSource: contact.applicationContactSource,
                    collectOnly: !contact.applicationContactEmail,
                    publishedAt: job.job_posted_at_datetime_utc ? new Date(job.job_posted_at_datetime_utc) : new Date(),
                    isActive: true,
                  },
                },
                upsert: true,
              },
            });
            seen += 1;
          }

          if (ops.length > 0) {
            await Job.bulkWrite(ops, { ordered: false });
            synced += ops.length;
            providerStats.jsearch.synced += ops.length;
          }
        }
        providerStats.jsearch.status = 'ok';
      } catch (jsearchError) {
        providerStats.jsearch.status = 'failed';
        providerStats.jsearch.error = jsearchError.message;
        logger.warn(`JSearch sync skipped: ${jsearchError.message}`);
      }
    } else {
      providerStats.jsearch.status = 'skipped';
      logger.info('JSearch sync skipped: RAPIDAPI_KEY not configured');
    }

    // Careerjet (optional, enabled when CAREERJET_API_KEY is configured)
    if (process.env.CAREERJET_API_KEY) {
      try {
        const careerjetApiUrl = process.env.CAREERJET_API_URL || 'https://search.api.careerjet.net/v4/query';
        const careerjetLocale = process.env.CAREERJET_LOCALE_CODE || 'en_US';
        const careerjetKeywords = process.env.CAREERJET_KEYWORDS || 'remote software engineer';
        const careerjetLocation = process.env.CAREERJET_LOCATION || '';
        const careerjetMaxPages = Math.min(Math.max(Number(process.env.CAREERJET_MAX_PAGES || 3), 1), 15);
        const careerjetPageSize = Math.min(Math.max(Number(process.env.CAREERJET_PAGE_SIZE || 20), 1), 100);
        const careerjetUserIp = String(process.env.CAREERJET_USER_IP || '').trim();
        const careerjetUserAgent = String(process.env.CAREERJET_USER_AGENT || 'CashFlowHubsBot/1.0').trim();
        const auth = Buffer.from(`${process.env.CAREERJET_API_KEY}:`).toString('base64');
        let seen = 0;

        if (!careerjetUserIp) {
          throw new Error('CAREERJET_USER_IP is required by Careerjet API');
        }

        for (let page = 1; page <= careerjetMaxPages && seen < remoteLimit; page++) {
          const careerjetRes = await axios.get(careerjetApiUrl, {
            timeout: 12000,
            headers: {
              Authorization: `Basic ${auth}`,
            },
            params: {
              locale_code: careerjetLocale,
              keywords: careerjetKeywords,
              location: careerjetLocation,
              page,
              page_size: careerjetPageSize,
              user_ip: careerjetUserIp,
              user_agent: careerjetUserAgent,
              sort: 'date',
              fragment_size: 400,
            },
          });

          const jobs = Array.isArray(careerjetRes.data?.jobs) ? careerjetRes.data.jobs : [];
          if (jobs.length === 0) break;

          const ops = [];
          for (const job of jobs) {
            if (seen >= remoteLimit) break;

            const remoteText = `${job.locations || ''} ${job.title || ''} ${job.description || ''}`.toLowerCase();
            const isRemote = /\bremote\b|work from home|telecommute/.test(remoteText);
            if (!isRemote) continue;

            const applicationUrl = String(job.url || '').trim();
            const externalIdRaw = String(job.id || `${job.url || ''}-${job.title || ''}-${job.company || ''}`).trim();
            if (!applicationUrl || !externalIdRaw) continue;

            const contact = discoverApplicationContact({
              title: job.title || '',
              company: job.company || '',
              description: job.description || '',
              applicationUrl,
              source: 'careerjet',
            });

            ops.push({
              updateOne: {
                filter: { externalId: `careerjet-${externalIdRaw}` },
                update: {
                  $set: {
                    externalId: `careerjet-${externalIdRaw}`,
                    source: 'careerjet',
                    title: String(job.title || 'Remote role').trim(),
                    company: String(job.company || 'Unknown company').trim(),
                    companyLogo: null,
                    category: inferCareerjetCategory(job),
                    categoryOther: null,
                    jobType: normalizeJobType(job.contract_type || 'full-time', 'full-time'),
                    location: 'Remote',
                    salary: null,
                    description: stripHtml(job.description || '').slice(0, 4000),
                    tags: ['careerjet', careerjetLocale],
                    applicationUrl,
                    applicationContactEmail: contact.applicationContactEmail,
                    applicationContactSource: contact.applicationContactSource,
                    collectOnly: !contact.applicationContactEmail,
                    publishedAt: job.date ? new Date(job.date) : new Date(),
                    isActive: true,
                  },
                },
                upsert: true,
              },
            });
            seen += 1;
          }

          if (ops.length > 0) {
            await Job.bulkWrite(ops, { ordered: false });
            synced += ops.length;
            providerStats.careerjet.synced += ops.length;
          }
        }
        providerStats.careerjet.status = 'ok';
      } catch (careerjetError) {
        providerStats.careerjet.status = 'failed';
        providerStats.careerjet.error = careerjetError.message;
        logger.warn(`Careerjet sync skipped: ${careerjetError.message}`);
      }
    } else {
      providerStats.careerjet.status = 'skipped';
      logger.info('Careerjet sync skipped: CAREERJET_API_KEY not configured');
    }

    // Jooble (optional, enabled when JOOBLE_API_KEY is configured)
    if (process.env.JOOBLE_API_KEY) {
      try {
        const joobleCountry = String(process.env.JOOBLE_COUNTRY || 'ke').toLowerCase();
        const joobleKeywords = process.env.JOOBLE_KEYWORDS || 'remote';
        const joobleLocation = process.env.JOOBLE_LOCATION || '';
        const joobleApiUrl = process.env.JOOBLE_API_URL || 'https://jooble.org/api';

        const joobleRes = await axios.post(
          `${joobleApiUrl.replace(/\/+$/, '')}/${process.env.JOOBLE_API_KEY}`,
          {
            keywords: joobleKeywords,
            location: joobleLocation,
            page: 1,
          },
          {
            timeout: 12000,
            headers: { 'Content-Type': 'application/json' },
          }
        );

        const joobleJobs = joobleRes.data?.jobs || [];
        for (const job of joobleJobs.slice(0, remoteLimit)) {
          const applicationUrl = job.link || job.url;
          if (!applicationUrl) continue;
          const externalId = job.id || job.link || `${job.title || 'job'}-${job.company || 'company'}`;
          const contact = discoverApplicationContact({
            title: job.title || '',
            company: job.company || '',
            description: job.snippet || job.description || '',
            applicationUrl: String(applicationUrl || ''),
            source: 'jooble',
          });

          await Job.findOneAndUpdate(
            { externalId: `jooble-${externalId}` },
            {
              externalId: `jooble-${externalId}`,
              source: 'jooble',
              title: job.title || 'Remote role',
              company: job.company || 'Unknown company',
              companyLogo: null,
              category: job.category || 'Other',
              jobType: normalizeJobType(job.type),
              location: job.location || 'Remote',
              salary: job.salary || null,
              description: (job.snippet || job.description || '').slice(0, 2000),
              tags: ['jooble', joobleCountry],
              applicationUrl,
              applicationContactEmail: contact.applicationContactEmail,
              applicationContactSource: contact.applicationContactSource,
              collectOnly: !contact.applicationContactEmail,
              publishedAt: job.updated ? new Date(job.updated) : new Date(),
              isActive: true,
            },
            { upsert: true, new: true }
          );
          synced++;
          providerStats.jooble.synced++;
        }
        providerStats.jooble.status = 'ok';
      } catch (joobleError) {
        providerStats.jooble.status = 'failed';
        providerStats.jooble.error = joobleError.message;
        logger.warn(`Jooble sync skipped: ${joobleError.message}`);
      }
    } else {
      providerStats.jooble.status = 'skipped';
      logger.info('Jooble sync skipped: JOOBLE_API_KEY not configured');
    }

    // Adzuna (optional, enabled when ADZUNA_APP_ID and ADZUNA_APP_KEY are configured)
    if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
      try {
        const adzunaCountry = String(process.env.ADZUNA_COUNTRY || 'us').toLowerCase();
        const adzunaKeywords = process.env.ADZUNA_WHAT || 'remote';
        const adzunaLocation = process.env.ADZUNA_WHERE || '';
        const adzunaPages = Math.min(Math.max(Number(process.env.ADZUNA_PAGES || 2), 1), 10);
        const adzunaResultsPerPage = Math.min(Math.max(Number(process.env.ADZUNA_RESULTS_PER_PAGE || 50), 1), 50);
        const adzunaMaxDaysOld = Math.min(Math.max(Number(process.env.ADZUNA_MAX_DAYS_OLD || 30), 1), 90);
        const adzunaBaseUrl = process.env.ADZUNA_API_URL || 'https://api.adzuna.com/v1/api/jobs';

        const adzunaParams = {
          app_id: process.env.ADZUNA_APP_ID,
          app_key: process.env.ADZUNA_APP_KEY,
          results_per_page: adzunaResultsPerPage,
          what: adzunaKeywords,
          max_days_old: adzunaMaxDaysOld,
          sort_by: 'date',
        };
        const seenAdzunaJobs = new Set();

        if (adzunaLocation) {
          adzunaParams.where = adzunaLocation;
        }

        for (let page = 1; page <= adzunaPages; page++) {
          const adzunaRes = await axios.get(`${adzunaBaseUrl.replace(/\/+$/, '')}/${adzunaCountry}/search/${page}`, {
            timeout: 12000,
            params: adzunaParams,
          });

          const adzunaJobs = adzunaRes.data?.results || [];
          for (const job of adzunaJobs.slice(0, remoteLimit)) {
            const applicationUrl = job.redirect_url || job.adref;
            if (!applicationUrl || !job.id) continue;
            const duplicateKey = buildJobDedupKey({
              source: 'adzuna',
              title: job.title || '',
              company: job.company?.display_name || '',
              location: job.location?.display_name || 'Remote',
            });
            if (seenAdzunaJobs.has(duplicateKey)) {
              continue;
            }
            seenAdzunaJobs.add(duplicateKey);

            const contact = discoverApplicationContact({
              title: job.title || '',
              company: job.company?.display_name || '',
              description: job.description || '',
              applicationUrl: String(applicationUrl || ''),
              source: 'adzuna',
            });

            await Job.findOneAndUpdate(
              { externalId: `adzuna-${job.id}` },
              {
                externalId: `adzuna-${job.id}`,
                source: 'adzuna',
                title: job.title || 'Remote role',
                company: job.company?.display_name || 'Unknown company',
                companyLogo: null,
                category: normalizeAdzunaCategory(job.category),
                jobType: normalizeJobType(job.contract_time || job.contract_type),
                location: job.location?.display_name || 'Remote',
                salary: formatAdzunaSalary(job),
                description: (job.description || '').slice(0, 4000),
                tags: ['adzuna', adzunaCountry, ...(job.contract_time ? [job.contract_time] : [])],
                applicationUrl,
                applicationContactEmail: contact.applicationContactEmail,
                applicationContactSource: contact.applicationContactSource,
                collectOnly: !contact.applicationContactEmail,
                publishedAt: job.created ? new Date(job.created) : new Date(),
                isActive: true,
              },
              { upsert: true, new: true }
            );
            synced++;
            providerStats.adzuna.synced++;
          }
        }
        providerStats.adzuna.status = 'ok';
      } catch (adzunaError) {
        providerStats.adzuna.status = 'failed';
        providerStats.adzuna.error = adzunaError.message;
        logger.warn(`Adzuna sync skipped: ${adzunaError.message}`);
      }
    } else {
      providerStats.adzuna.status = 'skipped';
      logger.info('Adzuna sync skipped: ADZUNA_APP_ID or ADZUNA_APP_KEY not configured');
    }

    // Hard-delete jobs older than 1 year.
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    await Job.deleteMany({ publishedAt: { $lt: oneYearAgo } });

    logger.info(`Job sync complete. Synced ${synced} jobs.`);
    return { success: true, synced, providers: providerStats };
  } catch (error) {
    logger.error(`syncJobs error: ${error.message}`);
    return { success: false, synced, providers: providerStats, error: error.message };
  }
};
