#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Challenge } = require('../src/models/Challenge');

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');

const CHALLENGE = {
  title: 'Ads Network Starter',
  description: 'Open the Ads Network page once today.',
  type: 'task',
  eventType: 'task_complete',
  targetCount: 1,
  rewardUSD: 0,
  xpReward: 25,
  sortOrder: 30,
  isDaily: true,
  resetDaily: true,
};

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

  const expiresAt = getTomorrowUtcMidnight();
  const filter = { title: CHALLENGE.title, isDaily: true };
  const update = {
    $set: {
      ...CHALLENGE,
      isActive: true,
      expiresAt,
    },
  };

  console.log(APPLY ? 'APPLY mode: the ads daily challenge will be upserted.' : 'Dry-run mode: no changes will be made. Use --apply to write.');
  console.log(`Challenge: ${CHALLENGE.title}`);

  try {
    if (APPLY) {
      const result = await Challenge.updateOne(filter, update, { upsert: true });
      console.log(`Upsert result: matched=${result.matchedCount || result.n || 0}, modified=${result.modifiedCount || result.nModified || 0}, upserted=${result.upsertedId ? result.upsertedId._id : result.upsertedId || 'none'}`);
    }
    console.log('Done.');
  } catch (error) {
    console.error(`Failed to seed ads daily challenge: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
