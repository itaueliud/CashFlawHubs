import { config, logger, metrics, startTelemetry } from "@platform/core";
import { storeFailedJob, upsertJob } from "@platform/db";
import { queues, Worker } from "@platform/queue";
import { scrapeUrl } from "@platform/scrapers";

const worker = new Worker("scrape", async (job) => {
  const payload = job.data as { source: string; url: string; companyHint?: string };
  try {
    const jobs = await scrapeUrl(payload);
    for (const item of jobs) {
      const id = await upsertJob(item);
      await queues.enrich.add("enrich-job", { dbId: id, job: item }, { jobId: `enrich:${item.hash}` });
      metrics.scrapedJobs.inc({ source: item.source });
    }
    logger.info({ url: payload.url, jobs: jobs.length }, "scrape complete");
  } catch (err) {
    await storeFailedJob(payload as Record<string, unknown>, (err as Error).message);
    throw err;
  }
}, {
  connection: queues.scrape.opts.connection,
  prefix: config.queuePrefix,
  concurrency: config.scrapeConcurrency,
  limiter: { max: config.scraperGlobalRps, duration: 1000 },
});

worker.on("failed", async (job, err) => {
  logger.error({ jobId: job?.id, err }, "scrape job failed");
  if ((job?.attemptsMade ?? 0) >= config.scraperRetryAttempts) {
    await queues.dlq.add("scrape-dlq", { original: job?.data, error: err.message });
  }
});

startTelemetry();
logger.info("scraper worker started");

