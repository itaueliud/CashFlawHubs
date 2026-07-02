require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const results = await mongoose.connection.db.collection('auditlogs')
      .aggregate([
        { $project: { userId: 1, userEmail: 1, userPhone: 1, action: 1, createdAt: 1 } },
        { $limit: 50 }
      ]).toArray();
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
