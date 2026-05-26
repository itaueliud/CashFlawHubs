import { config, logger, metrics, startTelemetry } from "@platform/core";
import { getJobById, markExpiredJobs } from "@platform/db";
import { queues, Worker } from "@platform/queue";

const worker = new Worker("publish", async (job) => {
  const { dbId } = job.data as { dbId: string };
  const row = await getJobById(dbId);
  if (!row) return;

  const res = await fetch(`${config.websiteApiBaseUrl}/jobs/sync`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": config.websiteApiKey },
    body: JSON.stringify(row),
  });

  if (!res.ok) throw new Error(`publish failed: ${res.status}`);
  metrics.publishedJobs.inc();
}, {
  connection: queues.publish.opts.connection,
  prefix: config.queuePrefix,
  concurrency: config.publishConcurrency,
});

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

worker.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "publish failed"));
startTelemetry();
logger.info("publisher worker started");

