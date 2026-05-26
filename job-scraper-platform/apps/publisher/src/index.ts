import { config, logger, metrics, startTelemetry } from "@platform/core";
import { getJobById, listJobsForPublish, markExpiredJobs } from "@platform/db";
import { queues, Worker } from "@platform/queue";
import type { Job } from "bullmq";

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

// Safety net for small/low-memory deployments: periodically publish a small batch of recent jobs
// even if the queue-based pipeline is slow or stalled.
const SAFETY_PUBLISH_EVERY_MS = Number(process.env.SAFETY_PUBLISH_EVERY_MS || 60_000);
const SAFETY_PUBLISH_LIMIT = Number(process.env.SAFETY_PUBLISH_LIMIT || 15);
const SAFETY_PUBLISH_HOURS_BACK = Number(process.env.SAFETY_PUBLISH_HOURS_BACK || 48);

setInterval(async () => {
  try {
    const batch = await listJobsForPublish(SAFETY_PUBLISH_LIMIT, SAFETY_PUBLISH_HOURS_BACK);
    for (const row of batch) {
      try {
        await publishRow(row);
      } catch (err) {
        logger.warn({ err }, "safety publish failed");
      }
    }
  } catch (err) {
    logger.warn({ err }, "safety publish batch failed");
  }
}, SAFETY_PUBLISH_EVERY_MS).unref();

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

worker.on("failed", (job: Job | undefined, err: Error) => logger.error({ jobId: job?.id, err }, "publish failed"));
startTelemetry();
logger.info("publisher worker started");

