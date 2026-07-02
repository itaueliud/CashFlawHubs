require('dotenv').config();
const mongoose = require('mongoose');

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected');

  const User = require('../src/models/User');
  const Wallet = require('../src/models/Wallet');
  const Referral = require('../src/models/Referral');
  const Transaction = require('../src/models/Transaction');
  const { getCurrencyRate } = require('../src/services/exchangeService');
  const { COUNTRIES } = require('../src/config/countries');

  // Inline localToUSD using the same logic as paymentController
  const localToUSD = async (amount, currency) => {
    if (currency === 'USD') return parseFloat(Number(amount).toFixed(4));
    const rate = await getCurrencyRate(currency);
    return parseFloat((amount / rate).toFixed(4));
  };

  const activatedUsers = await User.find({
    activationStatus: true,
    referredBy: { $ne: null },
  });

  console.log(`Found ${activatedUsers.length} activated referred users — checking each...`);

  let fixed = 0;
  let skipped = 0;

  for (const user of activatedUsers) {
    const existing = await Referral.findOne({ newUserId: user._id });
    if (existing) {
      skipped++;
      continue;
    }

    const referrer = await User.findOne({ referralCode: user.referredBy });
    if (!referrer) {
      console.log(`⚠️  Referrer not found for code ${user.referredBy} (user ${user._id})`);
      skipped++;
      continue;
    }

    const countryConfig = COUNTRIES[user.country];
    if (!countryConfig) {
      console.log(`⚠️  No country config for ${user.country} (user ${user._id})`);
      skipped++;
      continue;
    }

    let referralShareUSD;
    try {
      referralShareUSD = await localToUSD(countryConfig.referralReward, countryConfig.currency);
    } catch {
      referralShareUSD = parseFloat((countryConfig.referralReward / 130).toFixed(4));
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      await Referral.create([{
        referrerUserId: referrer._id,
        newUserId: user._id,
        referralCode: user.referredBy,
        rewardAmountUSD: referralShareUSD,
        rewardAmountLocal: countryConfig.referralReward,
        currency: countryConfig.currency,
        status: 'pending',
        createdAt: user.createdAt,
      }], { session });

      await Wallet.findOneAndUpdate(
        { userId: referrer._id },
        {
          $inc: {
            pendingBalance: referralShareUSD,
            referralEarnings: referralShareUSD,
            totalEarned: referralShareUSD,
          },
        },
        { session, upsert: true, setDefaultsOnInsert: true }
      );

      const txExists = await Transaction.findOne({
        userId: referrer._id,
        type: 'referral_reward',
        'metadata.sourceUserId': user._id.toString(),
      });

      if (!txExists) {
        await Transaction.create([{
          userId: referrer._id,
          type: 'referral_reward',
          amountLocal: countryConfig.referralReward,
          amountUSD: referralShareUSD,
          currency: countryConfig.currency,
          country: user.country,
          provider: 'internal',
          direction: 'credit',
          status: 'pending',
          processedAt: new Date(),
          metadata: {
            sourceUserId: user._id.toString(),
            sourceUserCode: user.userId,
            payoutSchedule: 'friday',
            note: 'Backfilled from manual activation',
          },
        }], { session });
      }

      await User.findByIdAndUpdate(
        referrer._id,
        { $inc: { totalReferrals: 1, xpPoints: 100 } },
        { session }
      );

      await session.commitTransaction();
      console.log(`✅ Fixed: ${user.phone || user._id} → referrer ${referrer.phone || referrer._id} (+$${referralShareUSD})`);
      fixed++;
    } catch (err) {
      await session.abortTransaction();
      console.log(`❌ Failed for user ${user._id}: ${err.message}`);
    } finally {
      session.endSession();
    }
  }

  console.log(`\n🎉 Done — ${fixed} fixed, ${skipped} skipped`);
  process.exit(0);
};

run().catch(err => {
  console.error('❌ Script failed:', err.message);
  process.exit(1);
});
