// Limit sync size for local verification to avoid long runs/timeouts
// Increase local sync limit for Careerjet run
process.env.REMOTE_JOB_SYNC_LIMIT = process.env.REMOTE_JOB_SYNC_LIMIT || '500';
require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const connectDB = require('./src/config/db');
const { syncJobs } = require('./src/controllers/jobController');
const Job = require('./src/models/Job');

(async () => {
  try {
    await connectDB();
    const result = await syncJobs();
    console.log('SYNC_RESULT');
    console.log(JSON.stringify(result, null, 2));

    const sources = ['themuse', 'jsearch', 'careerjet'];
    const docs = await Job.find({ source: { $in: sources }, isActive: true }).sort({ publishedAt: -1 }).limit(50).lean();
    console.log('PERSISTED_JOBS');
    console.log(JSON.stringify(docs.map((job) => ({
      source: job.source,
      externalId: job.externalId,
      title: job.title,
      company: job.company,
      applicationUrl: job.applicationUrl,
      publishedAt: job.publishedAt,
    })), null, 2));

    await mongoose.disconnect();
  } catch (error) {
    console.error('SYNC_FATAL_ERROR');
    console.error(error && error.stack ? error.stack : String(error));
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
})();
