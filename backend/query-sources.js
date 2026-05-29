require('dotenv').config({ path: './.env' });
const connectDB = require('./src/config/db');
const Job = require('./src/models/Job');
const mongoose = require('mongoose');

(async () => {
  try {
    await connectDB();
    const sources = ['themuse', 'jsearch', 'careerjet'];
    const out = {};
    for (const s of sources) {
      out[s] = {};
      out[s].count = await Job.countDocuments({ source: s });
      out[s].recent = await Job.find({ source: s }).sort({ publishedAt: -1 }).limit(5).lean();
    }
    console.log(JSON.stringify(out, null, 2));
    await mongoose.disconnect();
  } catch (err) {
    console.error(err && err.stack ? err.stack : String(err));
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
})();
