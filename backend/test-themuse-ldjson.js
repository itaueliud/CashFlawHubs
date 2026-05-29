const axios = require('axios');

const jobUrl = 'https://www.themuse.com/jobs/csl/director-state-government-affairs-southeastern-us';

(async () => {
  try {
    const res = await axios.get(jobUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = String(res.data || '');
    const scripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    console.log('Found ld+json scripts:', scripts.length);
    for (let i = 0; i < scripts.length; i++) {
      const txt = scripts[i][1];
      try {
        const obj = JSON.parse(txt);
        if (Array.isArray(obj)) {
          for (const o of obj) if (o['@type'] === 'JobPosting' || o.type === 'JobPosting') console.log('Found JobPosting in array', o.title || o.name || o.datePosted);
        } else if (obj['@type'] === 'JobPosting' || obj.type === 'JobPosting') {
          console.log('Found JobPosting', obj.title || obj.name || obj.datePosted);
        }
      } catch (e) {
        console.warn('parse failed', e.message);
      }
    }
  } catch (err) { console.error(err && err.message); }
})();
