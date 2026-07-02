#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Challenge } = require('../src/models/Challenge');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

const DESIRED_DAILY = [
  { title: 'Daily Login', xp: 10 },
  { title: 'Survey Starter', xp: 20 },
  { title: 'Survey Sprint', xp: 60 },
  { title: 'Task Starter', xp: 30 },
  { title: 'Task Master', xp: 60 },
  { title: 'Referral Starter', xp: 100 },
  { title: 'Referral Champion', xp: 180 },
  { title: 'Activity Mix', xp: 65 },
  { title: 'Daily Hustler', xp: 60 },
];

const LIFETIME = { title: 'Invite 10 Friends', xp: 150 };

const getTomorrowUtcMidnight = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
};

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!uri) {
    console.error('MONGODB_URI not set.');
    process.exit(1);
  }

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');
  console.log(APPLY ? 'APPLY mode: will perform updates.' : 'Dry-run mode: no writes. Use --apply to apply.');

  const tomorrow = getTomorrowUtcMidnight();
  const now = new Date();

  // Helper to process a title
  async function processTitle(title, isDaily, canonicalXp) {
    const docs = await Challenge.find({ title, isDaily }).sort({ createdAt: -1 });
    if (!docs || docs.length === 0) {
      console.log(`No documents found for title="${title}" isDaily=${isDaily}`);
      return;
    }
    console.log(`\nProcessing title="${title}" found=${docs.length}`);
    const keep = docs[0];
    console.log(`  Keeping id=${keep._id} (createdAt=${keep.createdAt})`);
    console.log(`  Canonical XP=${canonicalXp}, current xp=${keep.xpReward}`);
    if (APPLY) {
      await Challenge.updateOne({ _id: keep._id }, { $set: { xpReward: canonicalXp, rewardUSD: 0, isActive: true, expiresAt: isDaily ? tomorrow : null, resetDaily: !!isDaily, isDaily } });
      console.log('  Updated kept document.');
    }
    const toDeactivate = docs.slice(1);
    if (toDeactivate.length > 0) {
      console.log(`  Deactivating ${toDeactivate.length} duplicates:`);
      for (const d of toDeactivate) {
        console.log(`    id=${d._id} xp=${d.xpReward} isActive=${d.isActive} expiresAt=${d.expiresAt}`);
      }
      if (APPLY) {
        const ids = toDeactivate.map((d) => d._id);
        const res = await Challenge.updateMany({ _id: { $in: ids } }, { $set: { isActive: false, expiresAt: now } });
        console.log(`  Deactivated ${res.modifiedCount || res.nModified || 0} documents.`);
      }
    } else {
      console.log('  No duplicates to deactivate.');
    }
  }

  // Process daily titles
  for (const t of DESIRED_DAILY) {
    await processTitle(t.title, true, t.xp);
  }

  // Process lifetime
  await processTitle(LIFETIME.title, false, LIFETIME.xp);

  console.log('\nDone.');
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
