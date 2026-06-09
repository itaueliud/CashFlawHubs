#!/usr/bin/env node
const devAuthStore = require('../src/services/devAuthStore');

(async () => {
  try {
    const user = await devAuthStore.createUser({
      firstName: 'Dev',
      lastName: 'Referrer',
      name: 'Dev Referrer',
      email: 'dev.referrer@example.com',
      phone: '+10000000000',
      country: 'KE',
      passwordHash: 'password123',
      idNumber: null,
      idDocumentImage: null,
      faceVerificationImage: null,
      identityVerificationStatus: 'pending',
      referredBy: null,
      emailVerified: true,
      phoneVerified: true,
    });
    console.log('Created dev referrer:');
    console.log('Referral code:', user.referralCode);
    console.log('User id:', user.id);
  } catch (err) {
    console.error('Failed to create dev referrer:', err.message || err);
    process.exit(1);
  }
})();
