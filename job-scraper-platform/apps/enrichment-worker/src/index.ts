import { pool } from "@platform/db";
import { config, logger, NormalizedJob, startTelemetry } from "@platform/core";
import { queues, Worker } from "@platform/queue";
import { enrichJob } from "@platform/enrichment";

const worker = new Worker("enrich", async (job) => {
  const payload = job.data as { dbId: string; job: NormalizedJob };
  const enriched = await enrichJob(payload.job);

  await pool.query(
    `UPDATE jobs SET tags = $2, seniority = $3, employment_type = $4, remote = $5 WHERE id = $1::uuid`,
    [payload.dbId, enriched.tags, enriched.seniority, enriched.employmentType, enriched.remote],
  );

  await queues.publish.add("publish-job", { dbId: payload.dbId }, { jobId: `publish:${payload.job.hash}` });
}, {
  connection: queues.enrich.opts.connection,
  prefix: config.queuePrefix,
  concurrency: config.enrichConcurrency,
});

worker.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "enrichment failed"));
startTelemetry();
logger.info("enrichment worker started");

