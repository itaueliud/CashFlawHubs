require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Wallet = require('../src/models/Wallet');

const TEST_PHONE = process.argv[2] || '+254711111111';
const TARGET_TOKENS = Number(process.argv[3] || 200);

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.findOne({ phone: TEST_PHONE });
  if (!user) {
    console.error(`User not found for phone ${TEST_PHONE}`);
    process.exitCode = 1;
    await mongoose.connection.close();
    return;
  }

  user.tokenBalance = TARGET_TOKENS;
  await user.save();

  const wallet = await Wallet.findOneAndUpdate(
    { userId: user._id },
    { $set: { tokenBalance: TARGET_TOKENS } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log(`Updated ${user.phone} (${user.userId}) to ${TARGET_TOKENS} tokens`);
  console.log(`User tokenBalance: ${user.tokenBalance}`);
  console.log(`Wallet tokenBalance: ${wallet.tokenBalance}`);

  await mongoose.connection.close();
}

run().catch(async (error) => {
  console.error(`Failed to update test user tokens: ${error.message}`);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});

