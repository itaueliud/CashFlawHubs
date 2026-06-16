#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Challenge } = require('../src/models/Challenge');

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');

const CHALLENGE = {
  title: 'Ad Watcher',
  description: 'Spend a total of 2 hours on the Ads Network page within 24 hours to earn 200 XP.',
  type: 'earnings',
  eventType: 'ads_earning_2hr',
  targetCount: 1,
  rewardUSD: 0,
  xpReward: 200,
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
  console.log(APPLY ? 'APPLY mode: the ads daily challenge will be upserted.' : 'Dry-run mode: no changes will be made. Use --apply to write.');
  console.log(`Challenge: ${CHALLENGE.title}`);

  try {
    const existing = await Challenge.findOne({ eventType: CHALLENGE.eventType, isDaily: true });
    if (existing) {
      console.log('ℹ️  Challenge already exists — no changes made.');
      console.log('   Title:', existing.title);
      console.log('   ID:   ', existing._id);
      return;
    }

    if (APPLY) {
      const challenge = await Challenge.create({
        ...CHALLENGE,
        isActive: true,
        expiresAt,
      });
      console.log('🎉 Challenge created successfully!');
      console.log('   ID:   ', challenge._id);
      console.log('   Title:', challenge.title);
    } else {
      console.log('Dry-run complete. Use --apply to create the challenge.');
    }
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
