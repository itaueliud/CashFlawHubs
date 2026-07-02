const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const User = require('./src/models/User');
  const user = await User.findOne({ _id: '6a2a58fc26c525c5c6733c0a' });
  const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  
  try {
    const res = await axios.get('http://localhost:5000/api/jobs/my-posts?limit=50', {
      headers: { Authorization: 'Bearer ' + token }
    });
    console.log('API Response Jobs Length:', res.data.jobs.length);
  } catch (err) {
    console.log('API Error:', err.response?.data || err.message);
  }
  process.exit(0);
}
test().catch(console.error);
