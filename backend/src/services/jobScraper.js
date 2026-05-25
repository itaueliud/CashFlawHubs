const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const logger = require('../utils/logger');
const Job = require('../models/Job');

const http = axios.create({ timeout: Number(process.env.SCRAPER_HTTP_TIMEOUT_MS) || 15000 });

const DEFAULT_BATCH_SIZE = Number(process.env.SCRAPER_BATCH_SIZE) || 100;
const DEFAULT_MAX_JOBS = Number(process.env.SCRAPER_MAX_JOBS) || 100000;
const DEFAULT_MAX_PAGES = Number(process.env.SCRAPER_MAX_PAGES) || 1000;
const DEFAULT_RETRIES = Number(process.env.SCRAPER_RETRIES) || 3;
const DEFAULT_RETRY_DELAY_MS = Number(process.env.SCRAPER_RETRY_DELAY_MS) || 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeText = (value = '') => String(value).replace(/\s+/g, ' ').trim();

const safeDate = (value, fallback = new Date()) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const hashKey = (parts) => crypto.createHash('sha1').update(parts.map((part) => normalizeText(part).toLowerCase()).join('|')).digest('hex');

const withRetry = async (operation, { retries = DEFAULT_RETRIES, retryDelayMs = DEFAULT_RETRY_DELAY_MS, label = 'operation' } = {}) => {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (attempt === retries) break;
      const waitMs = retryDelayMs * (attempt + 1);
      logger.warn(`${label} failed on attempt ${attempt + 1}/${retries + 1}: ${error.message}. Retrying in ${waitMs}ms`);
      await sleep(waitMs);
    }
  }
  throw lastError;
};

const buildExternalId = (job, sourceName) => {
  if (job.externalId) return normalizeText(job.externalId);
  if (job.id) return `${sourceName}-${normalizeText(job.id)}`;
  if (job.applicationUrl) return `${sourceName}-${normalizeText(job.applicationUrl)}`;
  return `${sourceName}-${hashKey([job.title, job.company, job.location, job.description])}`;
};

const buildCanonicalKey = (job, sourceName) => {
  if (job.canonicalKey) return normalizeText(job.canonicalKey).toLowerCase();
  return hashKey([
    job.applicationUrl || job.url || sourceName,
    job.title,
    job.company,
    job.location,
    String(job.description || '').slice(0, 600),
  ]);
};

const normalizeJob = (job, sourceName) => {
  const source = job.source || sourceName;
  const applicationUrl = job.applicationUrl || job.url || null;
  const title = normalizeText(job.title || 'Remote role');
  const company = normalizeText(job.company || 'Unknown company');
  const location = normalizeText(job.location || 'Remote') || 'Remote';
  const description = normalizeText(job.description || job.jobDescription || job.snippet || '');
  const externalId = buildExternalId(job, sourceName);
  const canonicalKey = buildCanonicalKey({ ...job, title, company, location, description, applicationUrl }, sourceName);

  return {
    externalId,
    canonicalKey,
    source,
    title,
    company,
    companyLogo: job.companyLogo || job.company_logo || null,
    category: normalizeText(job.category || (Array.isArray(job.jobIndustry) ? job.jobIndustry[0] : '') || 'Other') || 'Other',
    jobType: normalizeText(job.jobType || job.job_type || job.type || 'full-time') || 'full-time',
    location,
    salary: job.salary || (job.annualSalaryMin ? `$${job.annualSalaryMin} - $${job.annualSalaryMax || job.annualSalaryMin}` : null),
    description: description.slice(0, 4000),
    tags: Array.isArray(job.tags)
      ? job.tags.filter(Boolean).map((tag) => normalizeText(tag)).filter(Boolean)
      : Array.isArray(job.jobLevel)
        ? job.jobLevel.filter(Boolean).map((tag) => normalizeText(tag)).filter(Boolean)
        : job.jobLevel
          ? [normalizeText(job.jobLevel)]
          : [],
    applicationUrl,
    publishedAt: safeDate(job.publishedAt || job.publication_date || job.pubDate || job.updated || job.created_at),
    isActive: true,
  };
};

const dedupeBatch = (items) => {
  const seen = new Map();
  for (const item of items) {
    const key = item.canonicalKey || item.externalId;
    if (!key) continue;
    seen.set(key, item);
  }
  return Array.from(seen.values());
};

const bulkUpsertJobs = async (records, { sourceName }) => {
  const jobs = dedupeBatch(records.map((record) => normalizeJob(record, sourceName)));
  if (jobs.length === 0) {
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0, processed: 0 };
  }

  const operations = jobs.map((job) => ({
    updateOne: {
      filter: job.canonicalKey
        ? { $or: [{ canonicalKey: job.canonicalKey }, { externalId: job.externalId }] }
        : { externalId: job.externalId },
      update: (() => {
        const { externalId, ...setDoc } = job;
        return {
          $set: {
            ...setDoc,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            externalId,
            createdAt: new Date(),
          },
        };
      })(),
      upsert: true,
    },
  }));

  const result = await withRetry(() => Job.bulkWrite(operations, { ordered: false }), {
    label: `bulk write for ${sourceName}`,
  });

  return {
    matchedCount: result.matchedCount || 0,
    modifiedCount: result.modifiedCount || 0,
    upsertedCount: result.upsertedCount || 0,
    processed: jobs.length,
  };
};

const fetchRemotive = async (limit) => {
  const url = process.env.REMOTIVE_API_URL || 'https://remotive.com/api/remote-jobs';
  const res = await withRetry(() => http.get(url), { label: 'fetch remotive' });
  return (res.data?.jobs || []).slice(0, limit).map((job) => ({
    source: 'remotive',
    externalId: `remotive-${job.id}`,
    title: job.title,
    company: job.company_name,
    companyLogo: job.company_logo,
    category: job.category || 'Other',
    jobType: job.job_type || 'full-time',
    location: 'Remote',
    salary: job.salary || null,
    description: job.description,
    tags: job.tags || [],
    applicationUrl: job.url,
    publishedAt: job.publication_date,
  }));
};

const fetchJobicy = async (limit) => {
  const url = process.env.JOBICY_API_URL || 'https://jobicy.com/api/v2/remote-jobs';
  const res = await withRetry(() => http.get(url), { label: 'fetch jobicy' });
  return (res.data?.jobs || []).slice(0, limit).map((job) => ({
    source: 'jobicy',
    externalId: `jobicy-${job.id}`,
    title: job.jobTitle || job.title,
    company: job.companyName || job.company,
    companyLogo: job.companyLogo || null,
    category: Array.isArray(job.jobIndustry) ? job.jobIndustry[0] : job.jobIndustry || 'Other',
    jobType: job.jobType || 'full-time',
    location: 'Remote',
    salary: job.annualSalaryMin ? `$${job.annualSalaryMin} - $${job.annualSalaryMax || job.annualSalaryMin}` : null,
    description: job.jobDescription || '',
    tags: job.jobLevel ? [job.jobLevel] : [],
    applicationUrl: job.url,
    publishedAt: job.pubDate,
  }));
};

const fetchJooble = async (limit) => {
  if (!process.env.JOOBLE_API_KEY) {
    logger.info('Jooble API skipped (JOOBLE_API_KEY missing)');
    return [];
  }

  const joobleApiUrl = process.env.JOOBLE_API_URL || 'https://jooble.org/api';
  const payload = {
    keywords: process.env.JOOBLE_KEYWORDS || 'remote',
    location: process.env.JOOBLE_LOCATION || '',
    page: 1,
  };

  try {
    const res = await withRetry(
      () => http.post(`${joobleApiUrl.replace(/\/+$/, '')}/${process.env.JOOBLE_API_KEY}`, payload, { headers: { 'Content-Type': 'application/json' } }),
      { label: 'fetch jooble' }
    );
    return (res.data?.jobs || []).slice(0, limit).map((job) => ({
      source: 'jooble',
      externalId: `jooble-${job.id || job.link || hashKey([job.title, job.company, job.location])}`,
      title: job.title || 'Remote role',
      company: job.company || 'Unknown company',
      companyLogo: null,
      category: job.category || 'Other',
      jobType: job.type || 'full-time',
      location: job.location || 'Remote',
      salary: job.salary || null,
      description: (job.snippet || job.description || '').slice(0, 4000),
      tags: ['jooble'],
      applicationUrl: job.link || job.url,
      publishedAt: job.updated || new Date(),
    }));
  } catch (error) {
    logger.warn(`jooble fetch failed: ${error.message}`);
    return [];
  }
};

const fetchHtmlPaginated = async (sourceConfig, limit) => {
  const items = [];
  const selector = sourceConfig.selector || 'article';
  const maxPages = Number(sourceConfig.maxPages || DEFAULT_MAX_PAGES);
  const pageTemplate = sourceConfig.baseUrl || '';

  for (let page = 1; page <= maxPages && items.length < limit; page += 1) {
    const url = pageTemplate.includes('{page}') ? pageTemplate.replace('{page}', page) : pageTemplate;
    if (!url) break;

    try {
      const res = await withRetry(() => http.get(url), { label: `fetch html page ${sourceConfig.source || 'html'}:${page}` });
      const $ = cheerio.load(res.data);
      const elements = $(selector);
      if (!elements.length) break;

      elements.each((_, el) => {
        if (items.length >= limit) return;
        const link = $(el).find('a').first();
        const applicationUrl = link.attr('href') || $(el).attr('data-href') || null;
        const title = normalizeText($(el).find('h1, h2, h3, .title, .job-title').first().text() || link.text() || $(el).text());
        const company = normalizeText($(el).find('.company, .company-name, [data-company]').first().text() || sourceConfig.defaultCompany || 'Unknown company');
        const location = normalizeText($(el).find('.location, .job-location').first().text() || sourceConfig.defaultLocation || 'Remote');
        const description = normalizeText($(el).find('p, .description, .job-description').first().text() || $(el).text());

        items.push({
          source: sourceConfig.source || 'html',
          title,
          company,
          location,
          description,
          applicationUrl,
          publishedAt: sourceConfig.publishedAt || new Date(),
          category: sourceConfig.category || 'Other',
          jobType: sourceConfig.jobType || 'full-time',
          tags: sourceConfig.tags || [],
        });
      });

      if (elements.length < (sourceConfig.pageSize || elements.length)) {
        break;
      }
    } catch (error) {
      logger.warn(`HTML fetch failed for ${url}: ${error.message}`);
      break;
    }
  }

  return items;
};

const loadCustomSources = () => {
  if (!process.env.SCRAPER_HTML_SOURCES) return [];
  try {
    const parsed = JSON.parse(process.env.SCRAPER_HTML_SOURCES);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((config) => ({
      name: config.source || 'html',
      type: 'html',
      ...config,
    }));
  } catch (error) {
    logger.warn('Invalid SCRAPER_HTML_SOURCES JSON');
    return [];
  }
};

const loadSources = () => ([
  {
    name: 'remotive',
    type: 'api',
    fetch: fetchRemotive,
  },
  {
    name: 'jobicy',
    type: 'api',
    fetch: fetchJobicy,
  },
  {
    name: 'jooble',
    type: 'api',
    fetch: fetchJooble,
  },
  ...loadCustomSources(),
]);

const processBatch = async (pendingBatch, sourceName, metrics) => {
  if (pendingBatch.length === 0) return;
  const result = await bulkUpsertJobs(pendingBatch, { sourceName });
  metrics.processed += result.processed;
  metrics.upserted += result.upsertedCount;
  metrics.matched += result.matchedCount;
  metrics.modified += result.modifiedCount;
  pendingBatch.length = 0;
};

const runSource = async (source, options, metrics) => {
  const maxJobs = options.maxJobs || DEFAULT_MAX_JOBS;
  const batchSize = options.batchSize || DEFAULT_BATCH_SIZE;
  const pendingBatch = [];
  let emitted = 0;

  logger.info(`Scraping source: ${source.name}`);

  const emitItems = async (items) => {
    for (const item of items) {
      if (metrics.processed >= maxJobs) return;
      pendingBatch.push(item);
      emitted += 1;
      if (pendingBatch.length >= batchSize) {
        await processBatch(pendingBatch, source.name, metrics);
      }
    }
  };

  if (source.type === 'html') {
    const items = await fetchHtmlPaginated(source, maxJobs);
    await emitItems(items);
  } else {
    const items = await source.fetch(maxJobs);
    await emitItems(items);
  }

  await processBatch(pendingBatch, source.name, metrics);

  logger.info(`Completed source: ${source.name}. Emitted ${emitted} items.`);
};

const deactivateOldJobs = async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await withRetry(() => Job.updateMany({ publishedAt: { $lt: thirtyDaysAgo } }, { isActive: false }), {
    label: 'deactivate old jobs',
  });
};

async function scrapeAll(options = {}) {
  const sources = options.sources || loadSources();
  const metrics = {
    processed: 0,
    upserted: 0,
    matched: 0,
    modified: 0,
  };

  for (const source of sources) {
    if (metrics.processed >= (options.maxJobs || DEFAULT_MAX_JOBS)) break;
    await runSource(source, options, metrics);
  }

  await deactivateOldJobs();

  logger.info(`Scrape complete. Processed ${metrics.processed} jobs, upserted ${metrics.upserted}, matched ${metrics.matched}, modified ${metrics.modified}.`);
  return metrics;
}

module.exports = {
  scrapeAll,
  loadSources,
  normalizeJob,
  bulkUpsertJobs,
};
