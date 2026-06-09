const axios = require('axios');

const API = 'http://localhost:5000/api';
const referralCode = 'REF-4BE10836'; // dev referrer created earlier
const email = `test.user+${Date.now()}@example.com`;

(async () => {
  try {
    console.log('Sending email verification for', email);
    const sendRes = await axios.post(`${API}/auth/send-email-verification`, { email, firstName: 'Test' }, { timeout: 15000 });
    console.log('send-email-verification response:', sendRes.data?.message || sendRes.data);
    const verifyLink = sendRes.data?.verifyLink;
    if (!verifyLink) {
      console.error('No verifyLink returned (not in dev mode?). Aborting test.');
      process.exit(1);
    }

    console.log('Visiting verify link to mark email verified...');
    const getRes = await axios.get(verifyLink, { maxRedirects: 0 }).catch((err) => {
      if (err.response && (err.response.status === 302 || err.response.status === 301)) return err.response;
      throw err;
    });
    console.log('verify-email-link response status:', getRes.status);

    console.log('Attempting registration...');
    const payload = {
      referralCode,
      firstName: 'Test',
      lastName: 'User',
      email,
      phone: '',
      country: 'KE',
      password: 'password123',
      confirmPassword: 'password123',
    };

    const regRes = await axios.post(`${API}/auth/register`, payload, { timeout: 15000 });
    console.log('Registration success:', regRes.data.success);
    console.log('User id:', regRes.data.user?.id || regRes.data.user?.userId);
    console.log('Token:', regRes.data.token ? 'received' : 'none');
  } catch (err) {
    console.error('Test failed:', err.response?.data || err.message || err);
    process.exit(1);
  }
})();
