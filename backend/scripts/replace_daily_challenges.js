#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Challenge } = require('../src/models/Challenge');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

const DESIRED_DAILY_TITLES = new Set([
  'Daily Login',
  'Survey Starter',
  'Survey Sprint',
  'Task Starter',
  'Task Master',
  'Referral Starter',
  'Referral Champion',
  'Activity Mix',
  'Daily Hustler',
]);

const DESIRED_DAILY = [
  { title: 'Daily Login', description: 'Log in 3 times today (at least 4 hours apart) to complete this challenge.', type: 'login', eventType: 'login', targetCount: 3, rewardUSD: 0, xpReward: 10, isDaily: true, resetDaily: true },
  { title: 'Survey Starter', description: 'Complete 1 survey today.', type: 'survey', eventType: 'survey_complete', targetCount: 1, rewardUSD: 0, xpReward: 20, isDaily: true, resetDaily: true },
  { title: 'Survey Sprint', description: 'Complete 3 surveys today.', type: 'survey', eventType: 'survey_complete_3', targetCount: 3, rewardUSD: 0, xpReward: 60, isDaily: true, resetDaily: true },
  { title: 'Task Starter', description: 'Complete 1 microtask today.', type: 'task', eventType: 'task_complete', targetCount: 1, rewardUSD: 0, xpReward: 30, isDaily: true, resetDaily: true },
  { title: 'Task Master', description: 'Complete 3 microtasks today.', type: 'task', eventType: 'task_complete_3', targetCount: 3, rewardUSD: 0, xpReward: 60, isDaily: true, resetDaily: true },
  { title: 'Referral Starter', description: 'Refer 1 friend today.', type: 'referral', eventType: 'referral', targetCount: 1, rewardUSD: 0, xpReward: 100, isDaily: true, resetDaily: true },
  { title: 'Referral Champion', description: 'Refer 2 friends today.', type: 'referral', eventType: 'referral_3', targetCount: 2, rewardUSD: 0, xpReward: 180, isDaily: true, resetDaily: true },
  { title: 'Activity Mix', description: 'Complete 4 earning actions today.', type: 'mixed', eventType: 'task_complete', targetCount: 4, rewardUSD: 0, xpReward: 65, isDaily: true, resetDaily: true },
  { title: 'Daily Hustler', description: 'Complete 5 earning actions today.', type: 'mixed', eventType: 'task_complete', targetCount: 5, rewardUSD: 0, xpReward: 60, isDaily: true, resetDaily: true },
];

const LIFETIME = { title: 'Invite 10 Friends', description: 'Invite 10 friends who register using your referral code.', type: 'referral', eventType: 'referral', targetCount: 10, rewardUSD: 0, xpReward: 150, isDaily: false, resetDaily: false };

const getTomorrowUtcMidnight = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
};

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!uri) {
    console.error('MONGODB_URI not set in backend/.env or environment. Aborting.');
    process.exit(1);
  }

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  console.log(APPLY ? 'APPLY mode: will deactivate non-listed daily challenges and upsert desired ones.' : 'Dry-run: no writes. Use --apply to perform changes.');

  try {
    // Find existing daily active challenges
    const now = new Date();
    const existingDaily = await Challenge.find({ isDaily: true, isActive: true });

    const toDeactivate = existingDaily.filter((c) => !DESIRED_DAILY_TITLES.has(c.title));
    console.log(`Found ${existingDaily.length} active daily challenges. ${toDeactivate.length} would be deactivated.`);
    toDeactivate.forEach((c) => console.log(`  Deactivate: ${c.title} (${c._id})`));

    if (APPLY && toDeactivate.length > 0) {
      const ids = toDeactivate.map((c) => c._id);
      const res = await Challenge.updateMany({ _id: { $in: ids } }, { $set: { isActive: false, expiresAt: now } });
      console.log(`Deactivated ${res.modifiedCount || res.nModified || 0} documents.`);
    }

    // Upsert desired daily (set expiresAt to tomorrow)
    const tomorrow = getTomorrowUtcMidnight();
    for (const tpl of DESIRED_DAILY) {
      const filter = { title: tpl.title, isDaily: true };
      const update = {
        $set: {
          title: tpl.title,
          description: tpl.description,
          type: tpl.type,
          eventType: tpl.eventType || tpl.type,
          targetCount: tpl.targetCount,
          rewardUSD: tpl.rewardUSD || 0,
          xpReward: tpl.xpReward,
          isDaily: true,
          resetDaily: tpl.resetDaily ?? true,
          isActive: true,
          expiresAt: tomorrow,
        },
      };
      console.log(`Upsert daily: ${tpl.title}`);
      if (APPLY) {
        const r = await Challenge.updateOne(filter, update, { upsert: true });
        console.log(`  matched=${r.matchedCount || r.n || 0}, modified=${r.modifiedCount || r.nModified || 0}`);
      }
    }

    // Ensure lifetime challenge exists; do not remove other lifetime challenges
    console.log(`Ensure lifetime: ${LIFETIME.title}`);
    if (APPLY) {
      const res = await Challenge.updateOne({ title: LIFETIME.title, isDaily: false }, { $setOnInsert: { ...LIFETIME, isActive: true } }, { upsert: true });
      console.log('Lifetime upsert result:', res.upsertedId ? 'created' : 'exists/updated');
    }

    console.log('Done.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
