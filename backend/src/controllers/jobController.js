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
    const jobsPromise = shouldPrioritizeRemoteSources
      ? Job.aggregate([
          { $match: query },
          {
            $addFields: {
              sourcePriority: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$source', 'scraper'] }, then: 6 },
                    { case: { $eq: ['$source', 'weworkremotely'] }, then: 5 },
                    { case: { $eq: ['$source', 'remoteok'] }, then: 4 },
                    { case: { $eq: ['$source', 'remotive'] }, then: 3 },
                    { case: { $eq: ['$source', 'jobicy'] }, then: 2 },
                    { case: { $eq: ['$source', 'jooble'] }, then: 1 },
                    { case: { $eq: ['$source', 'adzuna'] }, then: 0 },
                  ],
                  default: -1,
                },
              },
            },
          },
          { $sort: { sourcePriority: -1, publishedAt: -1 } },
          { $skip: skip },
          { $limit: Number(limit) },
        ])
      : Job.find(query).sort({ publishedAt: -1 }).skip(skip).limit(Number(limit));

    const [jobs, total] = await Promise.all([
      jobsPromise,
      Job.countDocuments(query),
    ]);
    const sourceCounts = await Job.aggregate([
      { $match: { isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const isStaff = ['admin', 'superadmin', 'ledger'].includes(req.user?.role || '');
    const scraperStats = isStaff
      ? await Job.aggregate([
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
      : [];

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
      }).select('status appliedAt createdAt tokenCost'),
      canManageApplications
        ? JobApplication.find({ jobId: job._id })
            .sort({ createdAt: -1 })
            .populate({
              path: 'userId',
              select: 'firstName lastName name email phone userId',
            })
            .select('status appliedAt createdAt updatedAt tokenCost coverLetter userId')
        : Promise.resolve([]),
    ]);

    job.views += 1;
    await job.save();

    const normalizedApplications = canManageApplications
      ? applications.map((application) => {
          const applicant = application.userId || {};
          return {
            _id: application._id,
            status: application.status,
            appliedAt: application.appliedAt,
            createdAt: application.createdAt,
            updatedAt: application.updatedAt,
            tokenCost: application.tokenCost || 0,
            coverLetter: application.coverLetter || '',
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
      userApplication,
      canManageApplications,
      applications: normalizedApplications,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
  const providerStats = {
    remotive: { synced: 0, status: 'pending' },
    jobicy: { synced: 0, status: 'pending' },
    remoteok: { synced: 0, status: 'pending' },
    arbeitnow: { synced: 0, status: 'pending' },
    weworkremotely: { synced: 0, status: 'pending' },
    jooble: { synced: 0, status: process.env.JOOBLE_API_KEY ? 'pending' : 'not_configured' },
    adzuna: { synced: 0, status: (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) ? 'pending' : 'not_configured' },
  };
  const remoteLimit = Math.min(Math.max(Number(process.env.JOBS_SYNC_LIMIT || 5000), 100), 20000);

  try {
    // Remotive
    try {
      const remotiveRes = await axios.get(process.env.REMOTIVE_API_URL || 'https://remotive.com/api/remote-jobs', {
        timeout: 10000,
      });
      const remotiveJobs = remotiveRes.data?.jobs || [];

      const remotiveOps = remotiveJobs.slice(0, remoteLimit).map((job) => ({
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
              publishedAt: new Date(job.publication_date),
              isActive: true,
            },
          },
          upsert: true,
        },
      }));
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
      const arbeitnowRes = await axios.get(process.env.ARBEITNOW_API_URL || 'https://www.arbeitnow.com/api/job-board-api', {
        timeout: 10000,
      });
      const arbeitnowJobs = Array.isArray(arbeitnowRes.data?.data) ? arbeitnowRes.data.data : [];

      for (const job of arbeitnowJobs.filter((item) => item?.remote === true).slice(0, remoteLimit)) {
        const applicationUrl = String(job.url || '').trim();
        const slug = String(job.slug || '').trim();
        if (!applicationUrl || !slug) continue;

        await Job.findOneAndUpdate(
          { externalId: `arbeitnow-${slug}` },
          {
            externalId: `arbeitnow-${slug}`,
            source: 'arbeitnow',
            title: String(job.title || 'Remote role').trim(),
            company: String(job.company_name || 'Unknown company').trim(),
            companyLogo: null,
            category: inferArbeitnowCategory(job),
            jobType: normalizeJobType(job.job_types || ['full-time']),
            location: normalizeRemoteLocation(job.location),
            salary: null,
            description: stripHtml(job.description || '').slice(0, 4000),
            tags: Array.isArray(job.tags) ? job.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
            applicationUrl,
            publishedAt: job.created_at ? new Date(job.created_at) : new Date(),
            isActive: true,
          },
          { upsert: true, new: true }
        );
        synced++;
        providerStats.arbeitnow.synced++;
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
