require('dotenv').config({ path: 'backend/.env' });
const mongoose = require('mongoose');
const connectDB = require('./backend/src/config/db');
const { syncJobs } = require('./backend/src/controllers/jobController');
const Job = require('./backend/src/models/Job');

(async () => {
  try {
    await connectDB();
    const result = await syncJobs();
    console.log('SYNC_RESULT');
    console.log(JSON.stringify(result, null, 2));

    const sources = ['themuse', 'jsearch', 'careerjet'];
    const docs = await Job.find({ source: { $in: sources }, isActive: true }).sort({ publishedAt: -1 }).limit(50);
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
    process.exitCode = 1;
    try { await mongoose.disconnect(); } catch (disconnectError) {}
  }
})();
