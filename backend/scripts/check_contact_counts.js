const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function main() {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      console.error('MONGODB_URI is not set in environment or .env');
      process.exit(2);
    }

    await mongoose.connect(uri, { maxPoolSize: 5 });
    console.log('Connected to MongoDB');

    const Job = require('../src/models/Job');

    const totalCount = await Job.countDocuments({});
    const contactCount = await Job.countDocuments({ applicationContactEmail: { $exists: true, $ne: null, $ne: '' } });

    console.log(`Total jobs: ${totalCount}`);
    console.log(`Jobs with applicationContactEmail: ${contactCount}`);

    const bySource = await Job.aggregate([
      {
        $group: {
          _id: '$source',
          total: { $sum: 1 },
          withContact: {
            $sum: {
              $cond: [
                { $and: [{ $ifNull: ['$applicationContactEmail', false] }, { $ne: ['$applicationContactEmail', ''] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { total: -1 } },
    ]).allowDiskUse(true);

    console.log('Counts by source:');
    for (const item of bySource) {
      const pct = item.total ? Math.round((item.withContact / item.total) * 100) : 0;
      console.log(`- ${item._id || 'unknown'}: ${item.withContact}/${item.total} (${pct}%)`);
    }

    // Print recent jobs sample (with contact)
    const samples = await Job.find({ applicationContactEmail: { $exists: true, $ne: null, $ne: '' } })
      .sort({ publishedAt: -1 })
      .limit(20)
      .select('source title company applicationUrl applicationContactEmail applicationContactSource publishedAt')
      .lean();

    console.log('\nRecent sample jobs with contact:');
    for (const s of samples) {
      console.log(`${s.source || 'unknown'} | ${s.title.slice(0,60)} | ${s.company} | ${s.applicationContactEmail} | ${s.applicationContactSource || '-'} | ${s.publishedAt}`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
}

main();
