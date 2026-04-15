require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const connectDB = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('MongoDB connected');
};

const seedDB = async () => {
  await connectDB();

  const User = require('../src/models/User');
  const Wallet = require('../src/models/Wallet');
  const { Challenge } = require('../src/models/Challenge');
  const Job = require('../src/models/Job');

  console.log('🌱 Seeding database...');

  // Clear collections
  await Promise.all([
    User.deleteMany({}),
    Wallet.deleteMany({}),
    Challenge.deleteMany({}),
    Job.deleteMany({}),
  ]);

  // Create superadmin user
  const superadmin = await User.create({
    name: 'CashFlawHubs Superadmin',
    phone: '+254700000001',
    email: 'superadmin@cashflawhubs.app',
    passwordHash: 'Superadmin@1234',
    country: 'KE',
    role: 'superadmin',
    activationStatus: true,
    phoneVerified: true,
    emailVerified: true,
  });
  await Wallet.create({ userId: superadmin._id, balanceUSD: 0 });
  console.log('✅ Superadmin user created — phone: +254700000001 / password: Superadmin@1234');

  // Create admin user
  const admin = await User.create({
    name: 'CashFlawHubs Admin',
    phone: '+254700000000',
    email: 'admin@cashflawhubs.app',
    passwordHash: 'Admin@1234',
    country: 'KE',
    role: 'admin',
    activationStatus: true,
    phoneVerified: true,
    emailVerified: true,
  });
  await Wallet.create({ userId: admin._id, balanceUSD: 0 });
  console.log('✅ Admin user created — phone: +254700000000 / password: Admin@1234');

  // Create test user
  const testUser = await User.create({
    name: 'Test User',
    phone: '+254711111111',
    passwordHash: 'Test@1234',
    country: 'KE',
    activationStatus: true,
    phoneVerified: true,
    xpPoints: 250,
    level: 2,
    streak: 5,
    surveysCompleted: 12,
    tasksCompleted: 8,
    totalReferrals: 3,
  });
  await Wallet.create({
    userId: testUser._id,
    balanceUSD: 12.40,
    surveyEarnings: 5.20,
    taskEarnings: 3.80,
    offerEarnings: 2.10,
    referralEarnings: 1.30,
    totalEarned: 12.40,
  });
  console.log('✅ Test user created — phone: +254711111111 / password: Test@1234');

  // Create daily challenges
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  await Challenge.insertMany([
    { title: 'Survey Starter', description: 'Complete 2 surveys today and earn a bonus', type: 'survey', targetCount: 2, rewardUSD: 0.50, xpReward: 50, isDaily: true, isActive: true, expiresAt: tomorrow },
    { title: 'Task Master', description: 'Complete 3 microtasks today', type: 'task', targetCount: 3, rewardUSD: 0.30, xpReward: 40, isDaily: true, isActive: true, expiresAt: tomorrow },
    { title: 'Referral Champion', description: 'Refer 1 friend to CashFlawHubs today', type: 'referral', targetCount: 1, rewardUSD: 0.20, xpReward: 100, isDaily: true, isActive: true, expiresAt: tomorrow },
    { title: 'Daily Login Bonus', description: 'Log in and stay active today', type: 'login', targetCount: 1, rewardUSD: 0.05, xpReward: 10, isDaily: true, isActive: true, expiresAt: tomorrow },
  ]);
  console.log('✅ Daily challenges seeded');

  // Create sample jobs
  await Job.insertMany([
    { externalId: 'seed-job-1', source: 'remotive', title: 'Senior React Developer', company: 'TechCorp Global', category: 'Software Development', jobType: 'full-time', location: 'Remote', salary: '$80,000 - $120,000/yr', description: 'We are looking for a senior React developer to join our fully remote team.', tags: ['React', 'TypeScript', 'Node.js'], applicationUrl: 'https://example.com/apply/1', publishedAt: new Date(), isActive: true },
    { externalId: 'seed-job-2', source: 'jobicy', title: 'Content Writer', company: 'Digital Media Co', category: 'Writing', jobType: 'part-time', location: 'Remote', salary: '$20 - $35/hr', description: 'Create engaging content for our blog, social media, and email newsletters.', tags: ['Writing', 'SEO', 'Content'], applicationUrl: 'https://example.com/apply/2', publishedAt: new Date(), isActive: true },
    { externalId: 'seed-job-3', source: 'remotive', title: 'Virtual Assistant', company: 'Startup Hub', category: 'Virtual Assistance', jobType: 'full-time', location: 'Remote', salary: '$15 - $25/hr', description: 'Support our executive team with scheduling, emails, and research tasks.', tags: ['Admin', 'Organization', 'Communication'], applicationUrl: 'https://example.com/apply/3', publishedAt: new Date(), isActive: true },
    { externalId: 'seed-job-4', source: 'jobicy', title: 'Customer Support Specialist', company: 'SaaS Company', category: 'Customer Support', jobType: 'full-time', location: 'Remote', salary: '$30,000 - $45,000/yr', description: 'Help our customers succeed by providing timely and helpful support via chat and email.', tags: ['Support', 'Communication', 'SaaS'], applicationUrl: 'https://example.com/apply/4', publishedAt: new Date(), isActive: true },
    { externalId: 'seed-job-5', source: 'remotive', title: 'Social Media Manager', company: 'Brand Agency Africa', category: 'Marketing', jobType: 'full-time', location: 'Remote', salary: '$25,000 - $40,000/yr', description: 'Manage social media accounts for our clients across Africa and globally.', tags: ['Social Media', 'Marketing', 'Content'], applicationUrl: 'https://example.com/apply/5', publishedAt: new Date(), isActive: true },
  ]);
  console.log('✅ Sample jobs seeded');

  console.log('\n🎉 Database seeding complete!');
  console.log('\nTest credentials:');
  console.log('  Superadmin → +254700000001 / Superadmin@1234');
  console.log('  Admin  → +254700000000 / Admin@1234');
  console.log('  User   → +254711111111 / Test@1234');
  process.exit(0);
};

seedDB().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
