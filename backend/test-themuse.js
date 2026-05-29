const axios = require('axios');

const THEMUSE_BASE_URL = 'https://www.themuse.com';
const THEMUSE_JOB_CATEGORIES = [
  'software_engineering',
  'computer_it',
  'data_analytics',
  'design_ux',
  'business_operations',
  'customer_service',
  'project_management',
  'sales',
  'advertising_marketing',
  'human_resources_recruitment',
];

const THEMUSE_CATEGORY_MAP = { /* trimmed for test */ };

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

  try {
    return JSON.parse(match[1]);
  } catch (error) {
    try {
      const normalized = match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      return JSON.parse(normalized);
    } catch (retryError) {
      console.warn(`Failed to parse The Muse job posting JSON-LD: ${retryError.message}`);
      return null;
    }
  }
};

const isTheMuseRemoteJob = (jobData) => {
  if (!jobData) return false;
  if (jobData.jobLocationType === 'TELECOMMUTE') return true;

  const locationText = `${jobData.jobLocationType || ''} ${jobData.jobLocation || ''} ${jobData.description || ''}`.toLowerCase();
  return /(remote|telecommute|work from home|flexible)/.test(locationText);
};

const fetchTheMuseJobs = async (remoteLimit = 20) => {
  const discoveredUrls = new Set();
  const categoryPageUrls = [];

  for (const categorySlug of THEMUSE_JOB_CATEGORIES) {
    for (let page = 1; page <= 2; page++) {
      const url = page === 1
        ? `${THEMUSE_BASE_URL}/search/category/${categorySlug}/`
        : `${THEMUSE_BASE_URL}/search/category/${categorySlug}/?page=${page}`;
      categoryPageUrls.push({ categorySlug, url });
    }
  }

  for (const { categorySlug, url } of categoryPageUrls) {
    console.log('Fetching category page', categorySlug, url);
    try {
      const pageRes = await axios.get(url, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log('Fetched', categorySlug, 'status', pageRes.status);
      const links = extractTheMuseJobLinks(String(pageRes.data || ''));
      console.log('Found links on', categorySlug, links.length);
      for (const jobUrl of links) {
        discoveredUrls.add(jobUrl);
      }
    } catch (error) {
      console.warn(`The Muse category page sync failed for ${categorySlug}: ${error.message}`);
    }
  }

  const jobs = [];
  for (const jobUrl of [...discoveredUrls]) {
    if (jobs.length >= remoteLimit) break;
    console.log('Fetching detail', jobUrl);

    try {
      const detailRes = await axios.get(jobUrl, { timeout: 10000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      console.log('Fetched detail', jobUrl, 'status', detailRes.status);
      const jobData = parseTheMuseJobPosting(String(detailRes.data || ''));

      if (!jobData || !isTheMuseRemoteJob(jobData)) continue;

      jobs.push({ title: jobData.title, company: jobData.hiringOrganization?.name, url: jobUrl });
    } catch (error) {
      console.warn(`The Muse detail sync failed for ${jobUrl}: ${error.message}`);
    }
  }

  return jobs;
};

(async () => {
  const jobs = await fetchTheMuseJobs(20);
  console.log('Found', jobs.length, 'jobs');
  console.log(jobs.slice(0,5));
})();
