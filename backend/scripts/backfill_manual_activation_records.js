require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../src/models/User');
const Wallet = require('../src/models/Wallet');
const Transaction = require('../src/models/Transaction');
const Referral = require('../src/models/Referral');
const { COUNTRIES } = require('../src/config/countries');
const { getCurrencyRate } = require('../src/services/exchangeService');

const DEFAULT_TARGET = {
  firstName: 'Peter',
  lastName: 'Mutuku',
  name: 'Peter Mutuku',
  email: 'petersmutuku@gmail.com',
};

const parseArgs = () => {
  const args = process.argv.slice(2);
  const flags = new Map();

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;

    const [key, inlineValue] = arg.slice(2).split('=');
    if (inlineValue !== undefined) {
      flags.set(key, inlineValue);
      continue;
    }

    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      flags.set(key, next);
      i += 1;
    } else {
      flags.set(key, 'true');
    }
  }

  return {
    dryRun: flags.get('dry-run') === 'true' || flags.get('dryRun') === 'true',
    userId: flags.get('userId') || process.env.TARGET_USER_ID || '',
    email: flags.get('email') || process.env.TARGET_EMAIL || DEFAULT_TARGET.email,
    phone: flags.get('phone') || process.env.TARGET_PHONE || '',
  };
};

const toUSD = async (amountLocal, currency) => {
  const amount = Number(amountLocal || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (String(currency || '').toUpperCase() === 'USD') return Number(amount.toFixed(4));

  try {
    const rate = await getCurrencyRate(currency);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error('Invalid exchange rate');
    return Number((amount / rate).toFixed(4));
  } catch {
    return Number((amount / 130).toFixed(4));
  }
};

const getActivationTarget = async ({ userId, email, phone }) => {
  const query = {};
  if (userId) query._id = userId;
  else if (email) query.email = String(email).trim().toLowerCase();
  else if (phone) query.phone = String(phone).trim();

  if (Object.keys(query).length === 0) {
    return User.find({ activationStatus: true }).sort({ createdAt: 1 });
  }

  const user = await User.findOne(query);
  return user ? [user] : [];
};

async function repairActivatedUser(user, { dryRun }) {
  const countryConfig = COUNTRIES[user.country];
  if (!countryConfig) {
    return { skipped: true, reason: `missing country config for ${user.country}` };
  }
  const activationFeeLocal = Number(countryConfig?.activationFee || 0);
  const activationCurrency = String(countryConfig?.currency || 'USD').toUpperCase();
  const activationAmountUSD = await toUSD(activationFeeLocal, activationCurrency);

  const [walletExists, activationTxExists, referralExists] = await Promise.all([
    Wallet.exists({ userId: user._id }),
    Transaction.exists({ userId: user._id, type: 'activation' }),
    user.referredBy ? Referral.exists({ newUserId: user._id }) : Promise.resolve(true),
  ]);

  const actions = [];

  if (!walletExists) actions.push('wallet');
  if (!activationTxExists) actions.push('activation_tx');
  if (user.referredBy && !referralExists) actions.push('referral');

  if (actions.length === 0) {
    return { skipped: true, reason: 'all records already present' };
  }

  if (dryRun) {
    return { skipped: false, dryRun: true, actions };
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!walletExists) {
      await Wallet.create([{ userId: user._id }], { session });
    }

    if (!activationTxExists) {
      const activationTx = await Transaction.create([{
        userId: user._id,
        type: 'activation',
        amountLocal: activationFeeLocal,
        amountUSD: activationAmountUSD,
        currency: activationCurrency,
        country: user.country,
        provider: 'manual',
        providerTransactionId: `manual-activation-${user._id}`,
        direction: 'debit',
        status: 'successful',
        processedAt: new Date(),
        metadata: {
          note: 'Backfilled after manual activation',
        },
      }], { session });

      const freshUser = await User.findById(user._id).session(session);
      freshUser.xpPoints = Number(freshUser.xpPoints || 0) + 50;
      if (typeof freshUser.checkLevelUp === 'function') {
        freshUser.checkLevelUp();
      }
      await freshUser.save({ session });

      actions.push(`activation_tx:${activationTx[0]?._id || 'created'}`);
    }

    if (user.referredBy && !referralExists) {
      const referrer = await User.findOne({ referralCode: user.referredBy }).session(session);
      const referralConfig = countryConfig;

      if (referrer && referralConfig) {
        const referralRewardUSD = await toUSD(referralConfig.referralReward, referralConfig.currency);

        await Referral.create([{
          referrerUserId: referrer._id,
          newUserId: user._id,
          referralCode: user.referredBy,
          rewardAmountUSD: referralRewardUSD,
          rewardAmountLocal: referralConfig.referralReward,
          currency: referralConfig.currency,
          status: 'pending',
          createdAt: user.createdAt,
        }], { session });

        await Wallet.findOneAndUpdate(
          { userId: referrer._id },
          {
            $inc: {
              pendingBalance: referralRewardUSD,
              referralEarnings: referralRewardUSD,
              totalEarned: referralRewardUSD,
            },
          },
          { session, upsert: true, setDefaultsOnInsert: true }
        );

        await Transaction.create([{
          userId: referrer._id,
          type: 'referral_reward',
          amountLocal: referralConfig.referralReward,
          amountUSD: referralRewardUSD,
          currency: referralConfig.currency,
          country: user.country,
          provider: 'internal',
          direction: 'credit',
          status: 'pending',
          processedAt: new Date(),
          metadata: {
            sourceUserId: user._id.toString(),
            sourceUserCode: user.userId,
            payoutSchedule: 'friday',
            note: 'Backfilled after manual activation',
          },
        }], { session });

        await User.findByIdAndUpdate(
          referrer._id,
          { $inc: { totalReferrals: 1, xpPoints: 100 } },
          { session }
        );

        actions.push('referral');
      } else {
        actions.push('referral_skipped');
      }
    }

    await session.commitTransaction();
    return { skipped: false, actions };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function main() {
  const { dryRun, userId, email, phone } = parseArgs();

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  console.log(`Targeting: ${DEFAULT_TARGET.name} <${DEFAULT_TARGET.email}>`);

  const targets = await getActivationTarget({ userId, email, phone });
  if (targets.length === 0) {
    console.log('No matching users found.');
    return;
  }

  let updated = 0;
  let skipped = 0;
  let dryRunCount = 0;

  for (const user of targets) {
    if (!user.activationStatus) {
      skipped += 1;
      console.log(`Skipping ${user.email || user.phone || user._id}: account is not activated`);
      continue;
    }

    const result = await repairActivatedUser(user, { dryRun });
    if (result.skipped) {
      skipped += 1;
      console.log(`Skipping ${user.email || user.phone || user._id}: ${result.reason}`);
      continue;
    }

    if (result.dryRun) {
      dryRunCount += 1;
      console.log(`Dry run ${user.email || user.phone || user._id}: would add ${result.actions.join(', ')}`);
      continue;
    }

    updated += 1;
    console.log(`Updated ${user.email || user.phone || user._id}: ${result.actions.join(', ')}`);
  }

  console.log(`\nDone. Updated: ${updated}, skipped: ${skipped}${dryRun ? `, dry-run matches: ${dryRunCount}` : ''}`);
}

main()
  .catch((error) => {
    console.error(`Backfill failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
  });
