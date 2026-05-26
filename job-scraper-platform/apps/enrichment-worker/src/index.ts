import { updateJobEnrichment } from "@platform/db";
import { config, logger, NormalizedJob, startTelemetry } from "@platform/core";
import { queues, Worker } from "@platform/queue";
import { enrichJob } from "@platform/enrichment";
import type { Job } from "bullmq";

const worker = new Worker("enrich", async (job: Job) => {
  const payload = job.data as { dbId: string; job: NormalizedJob };
  const enriched = await enrichJob(payload.job);

  await updateJobEnrichment(payload.dbId, {
    tags: enriched.tags,
    seniority: enriched.seniority,
    employmentType: enriched.employmentType,
    remote: enriched.remote,
  });

  await queues.publish.add("publish-job", { dbId: payload.dbId }, { jobId: `publish-${payload.job.hash}` });
}, {
  connection: queues.enrich.opts.connection,
  prefix: config.queuePrefix,
  concurrency: config.enrichConcurrency,
});

worker.on("failed", (job: Job | undefined, err: Error) => logger.error({ jobId: job?.id, err }, "enrichment failed"));
startTelemetry();
logger.info("enrichment worker started");

