const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const logger = require('../utils/logger');

const isValidJob = (job = {}) => Boolean(String(job.applicationUrl || '').trim() && String(job.title || '').trim());

router.post('/jobs/bulk-import', async (req, res) => {
  try {
    const providedKey = String(req.body?.apiKey || req.header('x-api-key') || '').trim();
    const expectedKey = String(process.env.INTERNAL_API_KEY || '').trim();

    if (!expectedKey || providedKey !== expectedKey) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const jobs = Array.isArray(req.body?.jobs) ? req.body.jobs.filter(isValidJob) : [];
    let inserted = 0;

    for (const job of jobs) {
      try {
        await Job.findOneAndUpdate(
          { applicationUrl: String(job.applicationUrl).trim(), source: String(job.source || 'remote').trim() },
          {
            ...job,
            isActive: true,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            updatedAt: new Date(),
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        inserted += 1;
      } catch (error) {
        logger.warn(`Failed to bulk import job ${job.title}: ${error.message}`);
      }
    }

    return res.json({ success: true, inserted });
  } catch (error) {
    logger.error(`bulk import failed: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Bulk import failed' });
  }
});

module.exports = router;
