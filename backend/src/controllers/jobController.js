const axios = require('axios');
const Job = require('../models/Job');
const { getRedis } = require('../config/redis');
const logger = require('../utils/logger');

// @GET /api/jobs
exports.getJobs = async (req, res) => {
  try {
    const { category, search, page = 1, limit = 20 } = req.query;
    const skip = (page - 1) * limit;

    const query = { isActive: true };
    if (category) query.category = category;
    if (search) query.$text = { $search: search };

    const [jobs, total] = await Promise.all([
      Job.find(query).sort({ publishedAt: -1 }).skip(skip).limit(Number(limit)),
      Job.countDocuments(query),
    ]);

    res.json({
      success: true,
      jobs,
      pagination: { total, page: Number(page), pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error(`getJobs error: ${error.message}`);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/jobs/categories
exports.getCategories = async (req, res) => {
  try {
    const categories = await Job.distinct('category', { isActive: true });
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @GET /api/jobs/:id
exports.getJob = async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    job.views += 1;
    await job.save();
    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Called by cron scheduler every 6 hours
exports.syncJobs = async () => {
  logger.info('Syncing remote jobs...');
  let synced = 0;

  try {
    // Remotive
    const remotiveRes = await axios.get(process.env.REMOTIVE_API_URL || 'https://remotive.com/api/remote-jobs', {
      timeout: 10000,
    });
    const remotiveJobs = remotiveRes.data?.jobs || [];

    for (const job of remotiveJobs.slice(0, 100)) {
      await Job.findOneAndUpdate(
        { externalId: `remotive-${job.id}` },
        {
          externalId: `remotive-${job.id}`,
          source: 'remotive',
          title: job.title,
          company: job.company_name,
          companyLogo: job.company_logo,
          category: job.category || 'Other',
          jobType: job.job_type || 'full-time',
          location: 'Remote',
          salary: job.salary || null,
          description: job.description?.slice(0, 2000) || '',
          tags: job.tags || [],
          applicationUrl: job.url,
          publishedAt: new Date(job.publication_date),
          isActive: true,
        },
        { upsert: true, new: true }
      );
      synced++;
    }

    // Jobicy
    const jobicyRes = await axios.get(process.env.JOBICY_API_URL || 'https://jobicy.com/api/v2/remote-jobs', {
      timeout: 10000,
    });
    const jobicyJobs = jobicyRes.data?.jobs || [];

    for (const job of jobicyJobs.slice(0, 100)) {
      await Job.findOneAndUpdate(
        { externalId: `jobicy-${job.id}` },
        {
          externalId: `jobicy-${job.id}`,
          source: 'jobicy',
          title: job.jobTitle,
          company: job.companyName,
          companyLogo: job.companyLogo || null,
          category: job.jobIndustry?.[0] || 'Other',
          jobType: job.jobType || 'full-time',
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
    }

    // Deactivate old jobs (>30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await Job.updateMany({ publishedAt: { $lt: thirtyDaysAgo } }, { isActive: false });

    logger.info(`Job sync complete. Synced ${synced} jobs.`);
  } catch (error) {
    logger.error(`syncJobs error: ${error.message}`);
  }
};
