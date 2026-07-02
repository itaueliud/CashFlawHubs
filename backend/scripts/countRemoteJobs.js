require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const col = mongoose.connection.db.collection('jobs');
    // Count documents where source is one of the known remote sources
    const remoteSources = [
      'remotive', 'jobicy', 'remoteok', 'weworkremotely',
      'jooble', 'adzuna', 'arbeitnow', 'themuse', 'jsearch', 'careerjet', 'internal', 'scraper'
    ];
    const count = await col.countDocuments({ source: { $in: remoteSources } });
    console.log('≈ Remote jobs count:', count);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
