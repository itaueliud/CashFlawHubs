require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Wallet = require('../src/models/Wallet');

const TARGET = {
  name: 'CashFlowHubs Ledger',
  email: 'ledger@cashflawhubs.app',
  phone: '+254700000002',
  country: 'KE',
  role: 'ledger',
};

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const readArg = (name) => {
  const index = args.findIndex((value) => value === name || value.startsWith(`${name}=`));
  if (index === -1) return '';
  const direct = args[index];
  if (direct.includes('=')) return direct.split('=').slice(1).join('=').trim();
  return args[index + 1] || '';
};

const requestedEmail = (readArg('--email') || TARGET.email).toLowerCase().trim();
const requestedPhone = (readArg('--phone') || TARGET.phone).trim();
const normalizePassword = (value = '') => String(value).trim().replace(/^['"]|['"]$/g, '');
const requestedPassword = normalizePassword(readArg('--password') || process.env.LEDGER_USER_PASSWORD || '');
const applyChanges = hasFlag('--apply');

const abort = (message) => {
  console.error(`ABORTED: ${message}`);
  process.exit(1);
};

if (requestedEmail !== TARGET.email || requestedPhone !== TARGET.phone) {
  abort(`This script is locked to ${TARGET.email} / ${TARGET.phone}.`);
}

if (!requestedPassword) {
  abort('Missing password. Pass --password or set LEDGER_USER_PASSWORD.');
}

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not configured');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const existing = await User.findOne({
      $or: [
        { email: TARGET.email },
        { phone: TARGET.phone },
      ],
    }).select('email phone role name');

    if (!applyChanges) {
      console.log('DRY_RUN: no changes made.');
      console.log(`Would ensure ledger user ${TARGET.email} (${TARGET.phone}) exists with role=${TARGET.role}.`);
      console.log(existing ? `Existing user found: ${existing.email || existing.phone} (${existing.role})` : 'No existing user found.');
      await mongoose.disconnect();
      process.exit(0);
    }

    if (existing && existing.role !== TARGET.role) {
      throw new Error(`A non-ledger user already exists with this email or phone: ${existing.email || existing.phone}`);
    }

    const passwordHash = await bcrypt.hash(requestedPassword, 12);
    let user = existing;

    if (!user) {
      user = await User.create({
        name: TARGET.name,
        email: TARGET.email,
        phone: TARGET.phone,
        passwordHash,
        country: TARGET.country,
        role: TARGET.role,
        activationStatus: true,
        emailVerified: true,
        phoneVerified: true,
        isActive: true,
        userAccessType: 'real',
      });
      console.log(`Created ledger user ${TARGET.email}.`);
    } else {
      user = await User.findByIdAndUpdate(
        user._id,
        {
          $set: {
            name: TARGET.name,
            email: TARGET.email,
            phone: TARGET.phone,
            passwordHash,
            country: TARGET.country,
            role: TARGET.role,
            activationStatus: true,
            emailVerified: true,
            phoneVerified: true,
            isActive: true,
            userAccessType: 'real',
            isBanned: false,
            banReason: null,
            failedLoginAttempts: 0,
            lockUntil: null,
          },
        },
        { new: true, runValidators: true }
      );
      console.log(`Updated ledger user ${TARGET.email}.`);
    }

    const wallet = await Wallet.findOneAndUpdate(
      { userId: user._id },
      { $set: { balanceUSD: 0 } },
      { upsert: true, new: true }
    );

    console.log(`USER_ID=${String(user._id)}`);
    console.log(`EMAIL=${TARGET.email}`);
    console.log(`PHONE=${TARGET.phone}`);
    console.log(`WALLET_ID=${String(wallet._id)}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`ERROR: ${error.message}`);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  }
})();
