const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const logger = require('../src/utils/logger');
const connectDB = require('../src/config/db');
const { scrapeAll } = require('../src/services/jobScraper');

const envLocalPath = path.join(__dirname, '..', '.env.local');
const envPath = path.join(__dirname, '..', '.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

const run = async () => {
  try {
    await connectDB();
    const max = Number(process.env.SCRAPER_MAX_JOBS || 10000);
    const concurrency = Number(process.env.SCRAPER_CONCURRENCY || 10);
    logger.info(`Starting job scraper (max=${max}, concurrency=${concurrency})`);
    const result = await scrapeAll({ maxJobs: max, concurrency });
    logger.info(`Scraper finished. ${JSON.stringify(result)}`);
  } catch (err) {
    logger.error(`Scraper failed: ${err.message}`);
  } finally {
    // allow pending writes to finish
    setTimeout(() => process.exit(0), 500);
  }
};

run();
