#!/usr/bin/env node
// Test script: stub axios.post then require notificationService and call sendSMS
process.env.NODE_ENV = 'production';
process.env.AFRICASTALKING_API_KEY = 'test_key';
process.env.AFRICASTALKING_USERNAME = 'test_user';
process.env.AFRICASTALKING_SENDER = 'TestSender';

const path = require('path');
try {
  const axiosPath = require.resolve('axios');
  require.cache[axiosPath] = {
    id: axiosPath,
    filename: axiosPath,
    loaded: true,
    exports: {
      post: async (...args) => {
        console.log('[stubbed axios.post] called with args:');
        console.log(JSON.stringify(args, null, 2));
        return { data: { status: 'OK' } };
      },
    },
  };
} catch (err) {
  console.error('Failed to stub axios:', err.message);
  process.exit(2);
}

const svc = require(path.join(__dirname, '..', 'src', 'services', 'notificationService'));

(async () => {
  try {
    console.log('Calling sendSMS...');
    await svc.sendSMS('+254700000000', 'Test message from Africa\'s Talking test');
    console.log('sendSMS completed successfully');
  } catch (err) {
    console.error('sendSMS failed:', err.message);
    process.exit(1);
  }
})();
