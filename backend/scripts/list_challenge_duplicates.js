#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { Challenge } = require('../src/models/Challenge');

async function run() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!uri) {
    console.error('MONGODB_URI not set.');
    process.exit(1);
  }
  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });

  const all = await Challenge.find({}).sort({ title: 1, createdAt: 1 }).lean();
  const map = new Map();
  for (const c of all) {
    const arr = map.get(c.title) || [];
    arr.push(c);
    map.set(c.title, arr);
  }

  console.log(`Total challenges: ${all.length}`);
  for (const [title, arr] of map.entries()) {
    if (arr.length > 1) {
      console.log(`\nDUPLICATE: "${title}" — count=${arr.length}`);
      for (const c of arr) {
        console.log(`  id=${c._id} isDaily=${c.isDaily} isActive=${c.isActive} xp=${c.xpReward} rewardUSD=${c.rewardUSD} expiresAt=${c.expiresAt}`);
      }
    }
  }

  console.log('\nAll active daily challenges:');
  const activeDaily = all.filter((c) => c.isDaily && c.isActive).sort((a,b)=>a.title.localeCompare(b.title));
  for (const c of activeDaily) {
    console.log(`  ${c.title} | id=${c._id} | xp=${c.xpReward} | expiresAt=${c.expiresAt}`);
  }

  await mongoose.disconnect();
}

run().catch((err)=>{console.error(err); process.exit(1);});
