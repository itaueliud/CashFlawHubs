require('dotenv').config();
const mongoose = require('mongoose');

async function checkDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected:', process.env.MONGODB_URI);
    
    const User = require('./src/models/User');
    
    const userCount = await User.countDocuments();
    console.log(`\n📊 Total users in database: ${userCount}`);
    
    if (userCount === 0) {
      console.log('\n❌ No users found! You need to run the seed script:');
      console.log('   node scripts/seed.js');
    } else {
      const users = await User.find({}).select('name phone userId role activationStatus');
      console.log('\n👥 Users found:');
      users.forEach(u => {
        console.log(`   - ${u.name} (${u.phone}) [${u.role}] ${u.activationStatus ? '✓' : '✗'}`);
      });
      
      // Check for admin
      const admin = await User.findOne({ phone: '+254700000000' });
      if (admin) {
        console.log('\n✅ Admin account exists:');
        console.log(`   Phone: +254700000000`);
        console.log(`   Password: Admin@1234 (use this to login)`);
      }
      
      // Check for test user
      const testUser = await User.findOne({ phone: '+254711111111' });
      if (testUser) {
        console.log('\n✅ Test user account exists:');
        console.log(`   Phone: +254711111111`);
        console.log(`   Password: Test@1234 (use this to login)`);
      }
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Check complete');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

checkDatabase();
