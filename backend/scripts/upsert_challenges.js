#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Challenge } = require('../src/models/Challenge');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');

const DAILY_CHALLENGES = [
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

const LIFETIME_CHALLENGES = [
  { title: 'Invite 10 Friends', description: 'Invite 10 friends who register using your referral code.', type: 'referral', eventType: 'referral', targetCount: 10, rewardUSD: 0, xpReward: 150, isDaily: false, resetDaily: false },
];

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

  const tomorrow = getTomorrowUtcMidnight();

  console.log(APPLY ? 'Running in APPLY mode — changes will be written.' : 'Dry-run mode — no changes will be made. Use --apply to apply.');

  try {
    for (const tpl of DAILY_CHALLENGES) {
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

      console.log(`Upsert (daily): ${tpl.title}`);
      if (APPLY) {
        const res = await Challenge.updateOne(filter, update, { upsert: true });
        console.log(`  Result: matched=${res.matchedCount || res.n || 0}, modified=${res.modifiedCount || res.nModified || 0}, upsertedId=${res.upsertedId ? res.upsertedId._id : res.upsertedId || 'none'}`);
      }
    }

    for (const tpl of LIFETIME_CHALLENGES) {
      const filter = { title: tpl.title, isDaily: false };
      const update = {
        $setOnInsert: {
          title: tpl.title,
          description: tpl.description,
          type: tpl.type,
          eventType: tpl.eventType || tpl.type,
          targetCount: tpl.targetCount,
          rewardUSD: tpl.rewardUSD || 0,
          xpReward: tpl.xpReward,
          isDaily: false,
          resetDaily: false,
          isActive: true,
        },
      };

      console.log(`Ensure (lifetime): ${tpl.title}`);
      if (APPLY) {
        const res = await Challenge.updateOne(filter, update, { upsert: true });
        console.log(`  Result: matched=${res.matchedCount || res.n || 0}, modified=${res.modifiedCount || res.nModified || 0}, upsertedId=${res.upsertedId ? res.upsertedId._id : res.upsertedId || 'none'}`);
      }
    }

    console.log('Done.');
  } catch (err) {
    console.error('Error during upsert:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
