require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const Notification = require('../src/models/Notification');

    const count = await Notification.countDocuments({ dedupeKey: null });
    console.log(`Found ${count} notifications with dedupeKey: null`);

    if (process.argv.includes('--confirm')) {
      const result = await Notification.updateMany(
        { dedupeKey: null },
        { $unset: { dedupeKey: '' } }
      );
      console.log(`Unset dedupeKey on ${result.modifiedCount} documents`);
    } else {
      console.log('Dry run only. Re-run with --confirm to apply the fix.');
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
})();
