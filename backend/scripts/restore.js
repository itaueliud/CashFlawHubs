require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const TEMP_PASSWORD = 'CashFlawHubs@2026';

const USERS_TO_RESTORE = [
  {
    _id: '69e62012380e2a9a75a2153a',
    name: 'CashFlawHubs Superadmin',
    firstName: 'Superadmin',
    lastName: 'CFH',
    phone: '+254700000001',
    email: 'superadmin@cashflawhubs.app',
    country: 'KE',
    role: 'superadmin',
    activationStatus: true,
    emailVerified: true,
    phoneVerified: true,
    tokenBalance: 200,
    xpPoints: 0,
    level: 1,
    streak: 0,
    walletUSD: 0,
  },
  {
    _id: '69f87b12ab1262bafb7a1bd6',
    name: 'CashFlawHubs Admin',
    firstName: 'Admin',
    lastName: 'CFH',
    phone: '+254700000000',
    email: 'admin@cashflawhubs.app',
    country: 'KE',
    role: 'admin',
    activationStatus: true,
    emailVerified: true,
    phoneVerified: true,
    tokenBalance: 200,
    xpPoints: 0,
    level: 1,
    streak: 0,
    walletUSD: 0,
  },
  {
    _id: '69f87b13ab1262bafb7a1bdc',
    name: 'CashFlawHubs Ledger',
    firstName: 'Ledger',
    lastName: 'CFH',
    phone: '+254700000002',
    email: 'ledger@cashflawhubs.app',
    country: 'KE',
    role: 'ledger',
    activationStatus: true,
    emailVerified: true,
    phoneVerified: true,
    tokenBalance: 200,
    xpPoints: 0,
    level: 1,
    streak: 0,
    walletUSD: 0,
  },
  {
    _id: '69f87b14ab1262bafb7a1be0',
    name: 'Test User',
    firstName: 'Test',
    lastName: 'User',
    phone: '+254790411222',
    email: 'testuser@cashflawhubs.app',
    country: 'KE',
    role: 'user',
    activationStatus: true,
    emailVerified: true,
    phoneVerified: true,
    tokenBalance: 200,
    xpPoints: 250,
    level: 2,
    streak: 5,
    walletUSD: 0,
  },
  {
    _id: '6a26c6e53d73a3a7bfb6324c',
    name: 'User 6a26c6',
    firstName: 'User',
    lastName: '6a26c6',
    country: 'KE',
    role: 'user',
    activationStatus: true,
    emailVerified: false,
    phoneVerified: false,
    tokenBalance: 10,
    xpPoints: 0,
    level: 1,
    streak: 0,
    walletUSD: 546.25,
  },
  {
    _id: '6a26c7903d73a3a7bfb632ed',
    name: 'User 254722384972',
    firstName: 'User',
    lastName: '722384972',
    phone: '+254722384972',
    country: 'KE',
    role: 'user',
    activationStatus: true,
    emailVerified: false,
    phoneVerified: true,
    tokenBalance: 10,
    xpPoints: 0,
    level: 1,
    streak: 0,
    walletUSD: 0,
  },
  {
    _id: '6a26e3b33d73a3a7bfb650fa',
    name: 'User 6a26e3',
    firstName: 'User',
    lastName: '6a26e3',
    country: 'KE',
    role: 'user',
    activationStatus: true,
    emailVerified: false,
    phoneVerified: false,
    tokenBalance: 10,
    xpPoints: 0,
    level: 1,
    streak: 0,
    walletUSD: 1.54,
  },
  {
    _id: '6a26e4bb3d73a3a7bfb651e7',
    name: 'User 6a26e4',
    firstName: 'User',
    lastName: '6a26e4',
    country: 'KE',
    role: 'user',
    activationStatus: true,
    emailVerified: false,
    phoneVerified: false,
    tokenBalance: 10,
    xpPoints: 0,
    level: 1,
    streak: 0,
    walletUSD: 0,
  },
  {
    _id: '6a26eb133d73a3a7bfb65dba',
    name: 'User 254740830041',
    firstName: 'User',
    lastName: '740830041',
    phone: '+254740830041',
    country: 'KE',
    role: 'user',
    activationStatus: true,
    emailVerified: false,
    phoneVerified: true,
    tokenBalance: 10,
    xpPoints: 0,
    level: 1,
    streak: 0,
    walletUSD: 0,
  },
  {
    _id: '6a27a5f33d73a3a7bfb6cbe8',
    name: 'User 6a27a5',
    firstName: 'User',
    lastName: '6a27a5',
    country: 'KE',
    role: 'user',
    activationStatus: false,
    emailVerified: false,
    phoneVerified: false,
    tokenBalance: 10,
    xpPoints: 0,
    level: 1,
    streak: 0,
    walletUSD: 0,
  },
  {
    _id: '6a287c1e7db84e95bbc12848',
    name: 'User 254116688022',
    firstName: 'User',
    lastName: '116688022',
    phone: '+254116688022',
    country: 'KE',
    role: 'user',
    activationStatus: true,
    emailVerified: false,
    phoneVerified: true,
    tokenBalance: 10,
    xpPoints: 0,
    level: 1,
    streak: 0,
    walletUSD: 0,
  },
  {
    _id: '6a2918a3d0da4f3015feba18',
    name: 'User 6a2918',
    firstName: 'User',
    lastName: '6a2918',
    country: 'KE',
    role: 'user',
    activationStatus: false,
    emailVerified: false,
    phoneVerified: false,
    tokenBalance: 10,
    xpPoints: 0,
    level: 1,
    streak: 0,
    walletUSD: 0,
  },
  {
    _id: '6a2936b1191d99f1c7f923e6',
    name: 'User 254748196599',
    firstName: 'User',
    lastName: '748196599',
    phone: '+254748196599',
    country: 'KE',
    role: 'user',
    activationStatus: true,
    emailVerified: false,
    phoneVerified: true,
    tokenBalance: 10,
    xpPoints: 0,
    level: 1,
    streak: 0,
    walletUSD: 0,
  },
  {
    _id: '6a29390e76ae9167a28c2d4a',
    name: 'User 6a2939',
    firstName: 'User',
    lastName: '6a2939',
    country: 'KE',
    role: 'user',
    activationStatus: false,
    emailVerified: false,
    phoneVerified: false,
    tokenBalance: 10,
    xpPoints: 0,
    level: 1,
    streak: 0,
    walletUSD: 0,
  },
  {
    _id: '69fbac650c3e1e50ba4b2a37',
    name: 'User Tanzania',
    firstName: 'User',
    lastName: 'TZ',
    country: 'TZ',
    role: 'user',
    activationStatus: true,
    emailVerified: false,
    phoneVerified: false,
    tokenBalance: 10,
    xpPoints: 0,
    level: 1,
    streak: 0,
    walletUSD: 0,
  },
];

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
};

const objectIdString = (value) => new mongoose.Types.ObjectId(String(value));

const makeRecoveryLogin = (user, index) => ({
  phone: user.phone || `+1999000${String(index + 1).padStart(4, '0')}`,
  email: user.email ? String(user.email).toLowerCase() : `restored-${String(user._id).slice(-8).toLowerCase()}@cashflawhubs.app`,
});

const buildUserDocument = async (user, passwordHash, loginIdentity) => ({
  _id: objectIdString(user._id),
  userId: `USR-${String(user._id).slice(-8).toUpperCase()}`,
  firstName: user.firstName,
  lastName: user.lastName,
  name: user.name,
  passwordHash,
  country: user.country,
  role: user.role || 'user',
  activationStatus: !!user.activationStatus,
  emailVerified: !!user.emailVerified,
  phoneVerified: !!user.phoneVerified,
  tokenBalance: user.tokenBalance ?? 10,
  totalTokensPurchased: 0,
  totalTokensSpent: 0,
  xpPoints: user.xpPoints ?? 0,
  level: user.level ?? 1,
  streak: user.streak ?? 0,
  failedLoginAttempts: 0,
  isActive: true,
  isBanned: false,
  referralCode: `REF-${String(user._id).slice(-8).toUpperCase()}`,
  identityVerificationStatus: 'pending',
  userAccessType: 'real',
  createdAt: new Date(),
  updatedAt: new Date(),
  phone: loginIdentity.phone,
  email: loginIdentity.email,
});

const buildUserUpdateFields = async (user, passwordHash, loginIdentity) => ({
  userId: `USR-${String(user._id).slice(-8).toUpperCase()}`,
  firstName: user.firstName,
  lastName: user.lastName,
  name: user.name,
  passwordHash,
  country: user.country,
  role: user.role || 'user',
  activationStatus: !!user.activationStatus,
  emailVerified: !!user.emailVerified,
  phoneVerified: !!user.phoneVerified,
  tokenBalance: user.tokenBalance ?? 10,
  totalTokensPurchased: 0,
  totalTokensSpent: 0,
  xpPoints: user.xpPoints ?? 0,
  level: user.level ?? 1,
  streak: user.streak ?? 0,
  failedLoginAttempts: 0,
  isActive: true,
  isBanned: false,
  referralCode: `REF-${String(user._id).slice(-8).toUpperCase()}`,
  identityVerificationStatus: 'pending',
  userAccessType: 'real',
  updatedAt: new Date(),
  phone: loginIdentity.phone,
  email: loginIdentity.email,
});

const findExistingUser = async (User, user, loginIdentity) => {
  const normalizedEmail = user.email ? String(user.email).toLowerCase() : null;
  const phoneCandidates = user.phone ? [user.phone, String(user.phone).trim()] : [];
  const recoveryEmail = loginIdentity?.email ? [loginIdentity.email] : [];
  const recoveryPhone = loginIdentity?.phone ? [loginIdentity.phone, String(loginIdentity.phone).trim()] : [];

  return User.findOne({
    $or: [
      { _id: objectIdString(user._id) },
      ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
      ...(phoneCandidates.length ? [{ phone: { $in: phoneCandidates } }] : []),
      ...(recoveryEmail.length ? [{ email: { $in: recoveryEmail } }] : []),
      ...(recoveryPhone.length ? [{ phone: { $in: recoveryPhone } }] : []),
    ],
  }).lean();
};

const buildWalletDocument = (user) => ({
  userId: objectIdString(user._id),
  balanceUSD: Math.max(0, Number(user.walletUSD || 0)),
  pendingBalance: 0,
  totalEarned: Math.max(0, Number(user.walletUSD || 0)),
  totalWithdrawn: 0,
  totalDeposited: 0,
  surveyEarnings: 0,
  taskEarnings: 0,
  offerEarnings: 0,
  referralEarnings: 0,
  freelanceEarnings: 0,
  challengeEarnings: 0,
  xpEarnings: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const restore = async () => {
  await connectDB();

  const userSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
  const walletSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

  const User = mongoose.models.User || mongoose.model('User', userSchema);
  const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);

  const hashedPassword = await bcrypt.hash(TEMP_PASSWORD, 12);
  let restored = 0;

  for (let i = 0; i < USERS_TO_RESTORE.length; i += 1) {
    const user = USERS_TO_RESTORE[i];
    const userObjectId = objectIdString(user._id);
    const loginIdentity = makeRecoveryLogin(user, i);
    const existing = await findExistingUser(User, user, loginIdentity);

    const userDoc = await buildUserDocument(user, hashedPassword, loginIdentity);
    const userUpdateFields = await buildUserUpdateFields(user, hashedPassword, loginIdentity);
    const walletDoc = buildWalletDocument(user);
    const targetUserId = existing?._id ? objectIdString(existing._id) : userObjectId;

    if (existing) {
      await User.collection.updateOne(
        { _id: targetUserId },
        {
          $set: {
            ...userUpdateFields,
          },
        },
        { upsert: true }
      );
      await Wallet.collection.updateOne(
        { userId: targetUserId },
        {
          $set: {
            ...walletDoc,
            userId: targetUserId,
          },
        },
        { upsert: true }
      );
      console.log(`↻ Updated: ${loginIdentity.phone} | ${loginIdentity.email}`);
      restored += 1;
      continue;
    }

    await User.collection.insertOne(userDoc);
    await Wallet.collection.updateOne(
      { userId: userObjectId },
      {
        $set: {
          ...walletDoc,
          userId: userObjectId,
        },
      },
      { upsert: true }
    );

    console.log(`✅ Restored: ${loginIdentity.phone} | ${loginIdentity.email}`);
    restored += 1;
  }

  console.log(`\n🎉 Done — ${restored} restored/updated`);
  console.log(`\n⚠️  All restored users will use the temporary password: ${TEMP_PASSWORD}`);
  console.log('You should force a password reset flow after they sign in.');
  console.log('Users without original phone/email were given recovery login values.');

  process.exit(0);
};

restore().catch((err) => {
  console.error('❌ Restore failed:', err);
  process.exit(1);
});
