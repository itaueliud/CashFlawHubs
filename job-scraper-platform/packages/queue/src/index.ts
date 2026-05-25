import { Queue, Worker, QueueEvents, JobsOptions } from "bullmq";
import IORedis from "ioredis";
import { config } from "@platform/core";

export const redis = new IORedis(config.redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });

export const defaultJobOptions: JobsOptions = {
  removeOnComplete: 1000,
  removeOnFail: 5000,
  attempts: config.scraperRetryAttempts,
  backoff: { type: "exponential", delay: 5000 },
};

export const queues = {
  discovery: new Queue("discovery", { connection: redis, prefix: config.queuePrefix, defaultJobOptions }),
  scrape: new Queue("scrape", { connection: redis, prefix: config.queuePrefix, defaultJobOptions }),
  enrich: new Queue("enrich", { connection: redis, prefix: config.queuePrefix, defaultJobOptions }),
  publish: new Queue("publish", { connection: redis, prefix: config.queuePrefix, defaultJobOptions }),
  dlq: new Queue("dlq", { connection: redis, prefix: config.queuePrefix }),
};

export const queueEvents = {
  scrape: new QueueEvents("scrape", { connection: redis, prefix: config.queuePrefix }),
  enrich: new QueueEvents("enrich", { connection: redis, prefix: config.queuePrefix }),
  publish: new QueueEvents("publish", { connection: redis, prefix: config.queuePrefix }),
};

export { Worker };

