const axios = require('axios');
const Job = require('../models/Job');
const JobApplication = require('../models/JobApplication');
const Transaction = require('../models/Transaction');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');
const { JOB_APPLICATION_TOKEN_TIERS, TOKEN_PACKAGES, JOB_POSTING_TOKEN_COST, getApplicationTokenCost } = require('../config/monetization');
const { scrapeAll } = require('../services/jobScraper');

// @GET /api/jobs
exports.getJobs = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;
    const now = new Date();

    const query = {
      isActive: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    };
    if (category) query.category = category;
    if (search) query.$text = { $search: search };

    const [jobs, total] = await Promise.all([
      Job.find(query).sort({ publishedAt: -1 }).skip(skip).limit(Number(limit)),
      Job.countDocuments(query),
    ]);

    res.json({
      success: true,
      jobs,
      tokenPolicy: {
        applicationTiers: JOB_APPLICATION_TOKEN_TIERS,
        tokenPackages: TOKEN_PACKAGES,
        postingCost: JOB_POSTING_TOKEN_COST,
      },
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
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
      jobType,
      location,
      salary,
      description,
      applicationUrl,
      tags = [],
      budgetAmount,
      budgetCurrency = 'KES',
      durationMonths,
    } = req.body;

    if (!title || !company || !category || !description || !applicationUrl) {
      return res.status(400).json({ success: false, message: 'Missing required job posting fields' });
    }

    const parsedDurationMonths = Number(durationMonths || 1);
    if (!Number.isInteger(parsedDurationMonths) || parsedDurationMonths < 1 || parsedDurationMonths > 3) {
      return res.status(400).json({
        success: false,
        message: 'Posting period must be between 1 and 3 months',
      });
    }

    const normalizedBudget = Number(budgetAmount) || 0;
    const applicationTokenCost = getApplicationTokenCost(normalizedBudget);
    const publishedAt = new Date();
    const expiresAt = new Date(publishedAt);
    expiresAt.setMonth(expiresAt.getMonth() + parsedDurationMonths);

    user.consumeTokens(JOB_POSTING_TOKEN_COST);
    await user.save();

    const job = await Job.create({
      externalId: `internal-${Date.now()}-${user.userId}`,
      source: 'internal',
      title,
      company,
      category,
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
      durationMonths: parsedDurationMonths,
      publishedAt,
      expiresAt,
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
    if (normalized.length > 0) {
      return res.json({ success: true, categories: normalized });
    }

    return res.json({
      success: true,
      categories: ['Other', 'Software Development', 'Design', 'Marketing', 'Customer Support'],
    });
  } catch (error) {
    logger.error(`getCategories error: ${error.message}`);
    return res.json({
      success: true,
      categories: ['Other', 'Software Development', 'Design', 'Marketing', 'Customer Support'],
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

// Called by cron scheduler every 6 hours
exports.syncJobs = async () => {
  logger.info('Syncing remote jobs with batched scraper pipeline...');
  try {
    return await scrapeAll({
      maxJobs: Number(process.env.JOBS_SYNC_LIMIT || process.env.SCRAPER_MAX_JOBS || 100000),
      batchSize: Number(process.env.SCRAPER_BATCH_SIZE || 100),
      retries: Number(process.env.SCRAPER_RETRIES || 3),
      retryDelayMs: Number(process.env.SCRAPER_RETRY_DELAY_MS || 500),
    });
  } catch (error) {
    logger.error(`syncJobs error: ${error.message}`);
    return { processed: 0, upserted: 0, matched: 0, modified: 0 };
  }
};
