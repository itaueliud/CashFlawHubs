require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('../src/models/User');

    const newPassword = crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, 'A');
    const hashed = await bcrypt.hash(newPassword, 12);

    const updated = await User.findOneAndUpdate(
      { email: 'admin@cashflawhubs.app' },
      { $set: { passwordHash: hashed, failedLoginAttempts: 0, lockUntil: null } },
      { new: true }
    );

    if (!updated) {
      console.error('Admin user not found');
      process.exit(1);
    }

    console.log('UPDATED_USER_ID=' + String(updated._id));
    console.log('NEW_PASSWORD=' + newPassword);

    await mongoose.disconnect();
    process.exit(0);
  } catch (e) {
    console.error('ERROR', e.message);
    process.exit(1);
  }
})();
