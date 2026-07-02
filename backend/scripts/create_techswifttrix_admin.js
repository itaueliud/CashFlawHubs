require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const ADMIN = {
  name: 'Tech Swift Trix',
  email: 'techswifttrix361@gmail.com',
  phone: '0112801021',
  password: 'B4j30@swift!!-90',
  country: 'KE',
  role: 'admin',
};

(async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not configured');
    }

    await mongoose.connect(process.env.MONGODB_URI);

    const existing = await User.findOne({
      $or: [
        { email: ADMIN.email.toLowerCase() },
        { phone: ADMIN.phone },
      ],
    }).select('email phone role name');

    if (existing) {
      console.error(`ABORTED: A user already exists with this email or phone (${existing.email || existing.phone}). No changes made.`);
      await mongoose.disconnect();
      process.exit(1);
    }

    const user = await User.create({
      name: ADMIN.name,
      email: ADMIN.email.toLowerCase(),
      phone: ADMIN.phone,
      passwordHash: ADMIN.password,
      country: ADMIN.country,
      role: ADMIN.role,
      activationStatus: true,
      emailVerified: true,
      phoneVerified: true,
      isActive: true,
      userAccessType: 'real',
    });

    console.log('Created admin account successfully.');
    console.log(`ID=${String(user._id)}`);
    console.log(`EMAIL=${ADMIN.email.toLowerCase()}`);
    console.log(`PHONE=${ADMIN.phone}`);

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
