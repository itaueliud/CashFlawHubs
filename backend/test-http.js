const axios = require('axios');

(async () => {
  try {
    const res = await axios.get('https://www.google.com', { timeout: 5000 });
    console.log('OK', res.status);
  } catch (err) {
    console.error('ERR', err && err.message);
  }
})();
