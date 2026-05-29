const axios = require('axios');

const THEMUSE_BASE_URL = 'https://www.themuse.com';
const categorySlug = 'software_engineering';

const extractTheMuseJobLinks = (html) => {
  const urls = new Set();
  const regex = /href=["']([^"']*\/jobs\/[^"']+)["']/gi;
  for (const match of html.matchAll(regex)) {
    const href = String(match[1] || '').trim();
    if (!href) continue;
    const normalizedUrl = href.startsWith('http')
      ? href
      : `${THEMUSE_BASE_URL}${href.startsWith('/') ? href : `/${href}`}`;
    urls.add(normalizedUrl.replace(/\/+$/, ''));
  }
  return [...urls];
};

const parseTheMuseJobPosting = (html) => {
  const match = html.match(/<script[^>]*id=["']job-posting-jsonld["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch (e) { return null; }
};

const isTheMuseRemoteJob = (jobData) => {
  if (!jobData) return false;
  if (jobData.jobLocationType === 'TELECOMMUTE') return true;
  const locationText = `${jobData.jobLocationType || ''} ${jobData.jobLocation || ''} ${jobData.description || ''}`.toLowerCase();
  return /(remote|telecommute|work from home|flexible)/.test(locationText);
};

(async () => {
  try {
    const url = `${THEMUSE_BASE_URL}/search/category/${categorySlug}/`;
    console.log('Fetching category', url);
    const pageRes = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
    const links = extractTheMuseJobLinks(String(pageRes.data || ''));
    console.log('Found links:', links.length);
    const jobs = [];
    for (const jobUrl of links.slice(0, 5)) {
      console.log('Fetching', jobUrl);
      try {
        const detailRes = await axios.get(jobUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const jobData = parseTheMuseJobPosting(String(detailRes.data || ''));
        console.log('Parsed?', !!jobData);
        if (jobData && isTheMuseRemoteJob(jobData)) jobs.push({ title: jobData.title, company: jobData.hiringOrganization?.name });
      } catch (err) { console.warn('detail failed', jobUrl, err.message); }
    }
    console.log('Jobs found:', jobs.length, jobs.slice(0,3));
  } catch (err) { console.error(err && err.message); }
})();
