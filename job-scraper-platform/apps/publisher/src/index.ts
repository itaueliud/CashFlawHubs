import { config, logger, metrics, startTelemetry } from "@platform/core";
import { getJobById, markExpiredJobs } from "@platform/db";
import { queues, Worker } from "@platform/queue";
import type { Job } from "bullmq";
import { fetchAllRemoteJobs } from "@platform/scrapers";

const publishRow = async (row: Record<string, unknown>): Promise<void> => {
  const res = await fetch(`${config.websiteApiBaseUrl}/jobs/sync`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": config.websiteApiKey },
    body: JSON.stringify(row),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`publish failed: ${res.status}${body ? ` ${body.slice(0, 300)}` : ""}`);
  }

  metrics.publishedJobs.inc();
};

const worker = new Worker("publish", async (job: Job) => {
  const { dbId } = job.data as { dbId: string };
  const row = await getJobById(dbId);
  if (!row) return;

  await publishRow(row);
}, {
  connection: queues.publish.opts.connection,
  prefix: config.queuePrefix,
  concurrency: config.publishConcurrency,
});

const chunkJobs = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
};

const publishRemoteJobs = async (): Promise<void> => {
  const jobs = await fetchAllRemoteJobs();
  if (jobs.length === 0) {
    logger.info("No remote jobs found to publish");
    return;
  }

  logger.info({ count: jobs.length }, "publishing remote jobs in bulk");
  for (const chunk of chunkJobs(jobs, 50)) {
    const response = await fetch(`${config.websiteApiBaseUrl}/api/internal/jobs/bulk-import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        apiKey: config.websiteApiKey,
        jobs: chunk,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`bulk publish failed: ${response.status}${body ? ` ${body.slice(0, 300)}` : ""}`);
    }
  }

  logger.info({ count: jobs.length }, "remote jobs published");
};

setInterval(async () => {
  const expired = await markExpiredJobs(72);
  if (expired > 0) {
    await fetch(`${config.websiteApiBaseUrl}/jobs/expire`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": config.websiteApiKey },
      body: JSON.stringify({ hoursWithoutSeen: 72 }),
    });
  }
}, 60_000);

const REMOTE_JOB_PUBLISH_EVERY_MS = Number(process.env.REMOTE_JOB_PUBLISH_EVERY_MS || 24 * 60 * 60 * 1000);
void publishRemoteJobs().catch((err) => logger.warn({ err }, "initial remote publish failed"));
setInterval(() => {
  void publishRemoteJobs().catch((err) => logger.warn({ err }, "remote publish failed"));
}, REMOTE_JOB_PUBLISH_EVERY_MS).unref();

worker.on("failed", (job: Job | undefined, err: Error) => logger.error({ jobId: job?.id, err }, "publish failed"));
startTelemetry();
logger.info("publisher worker started");

