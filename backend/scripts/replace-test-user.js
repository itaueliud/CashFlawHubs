require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const OLD_PHONE = '+254790411222';
const OLD_EMAIL = 'testuser@cashflawhubs.app';
const NEW_PHONE = '+254711111111';
const NEW_EMAIL = 'testuser@cashflawhubs.app';
const NEW_PASSWORD = 'Test@1234';

async function connectDB() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
}

async function main() {
  await connectDB();

  const userSchema = new mongoose.Schema({}, { strict: false, timestamps: true });
  const walletSchema = new mongoose.Schema({}, { strict: false, timestamps: true });

  const User = mongoose.models.User || mongoose.model('User', userSchema);
  const Wallet = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);
  const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 12);

  const matchQuery = {
    $or: [
      { phone: OLD_PHONE },
      { email: OLD_EMAIL },
      { phone: NEW_PHONE },
      { email: NEW_EMAIL },
    ],
  };

  const usersToRemove = await User.find(matchQuery).select('_id phone email').lean();
  const userIdsToRemove = usersToRemove.map((user) => user._id);

  if (userIdsToRemove.length > 0) {
    await Wallet.deleteMany({ userId: { $in: userIdsToRemove } });
    await User.deleteMany({ _id: { $in: userIdsToRemove } });
    console.log(`Removed ${userIdsToRemove.length} existing user record(s) and their wallet(s).`);
  } else {
    console.log('No matching old/new test user records found to remove.');
  }

  const createdUser = await User.create({
    firstName: 'Test',
    lastName: 'User',
    name: 'Test User',
    phone: NEW_PHONE,
    email: NEW_EMAIL,
    passwordHash: hashedPassword,
    country: 'KE',
    role: 'user',
    activationStatus: true,
    emailVerified: true,
    phoneVerified: true,
    tokenBalance: 200,
    xpPoints: 250,
    level: 2,
    streak: 5,
    surveysCompleted: 12,
    tasksCompleted: 8,
    totalReferrals: 3,
    userAccessType: 'real',
  });

  await Wallet.create({
    userId: createdUser._id,
    balanceUSD: 12.4,
    totalEarned: 12.4,
    surveyEarnings: 5.2,
    taskEarnings: 3.8,
    offerEarnings: 2.1,
    referralEarnings: 1.3,
  });

  console.log('Created fresh test user:');
  console.log(`  Phone: ${NEW_PHONE}`);
  console.log(`  Email: ${NEW_EMAIL}`);
  console.log(`  Password: ${NEW_PASSWORD}`);

  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Failed to replace test user:', err.message);
  try {
    await mongoose.connection.close();
  } catch {}
  process.exit(1);
});
