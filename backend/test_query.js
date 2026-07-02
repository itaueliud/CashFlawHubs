const mongoose = require('mongoose');
const Job = require('./src/models/Job');
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const userId = new mongoose.Types.ObjectId('6a2a58fc26c525c5c6733c0a');
  const ownerUserId = 'B41858918';
  
  const ownerExternalIdRegex = ownerUserId
    ? new RegExp('^internal-.*-' + ownerUserId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i')
    : null;

  const ownerConditions = [
    { postedBy: userId },
    { claimedBy: userId },
  ];
  if (ownerExternalIdRegex) {
    ownerConditions.push({ externalId: ownerExternalIdRegex });
  }
  
  const query = { $or: ownerConditions };
  console.log('Query:', JSON.stringify(query, null, 2));
  
  const jobs = await Job.find(query).lean();
  console.log('Jobs Found:', jobs.length);
  
  process.exit(0);
}
check().catch(console.error);
