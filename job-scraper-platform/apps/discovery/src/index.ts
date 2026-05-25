import { config, logger, metrics, startTelemetry } from "@platform/core";
import { queues } from "@platform/queue";
import { discoverCareerUrlsForDomain } from "@platform/scrapers";

const staticSeeds = [
  { source: "greenhouse", url: "https://boards.greenhouse.io/embed/job_board?for=airbyte", companyHint: "Airbyte" },
  { source: "lever", url: "https://jobs.lever.co/segment", companyHint: "Segment" },
  { source: "ashby", url: "https://jobs.ashbyhq.com/notion", companyHint: "Notion" },
] as const;

const run = async (): Promise<void> => {
  startTelemetry();

  for (const seed of staticSeeds) {
    await queues.scrape.add("scrape-url", seed, { jobId: `${seed.source}:${seed.url}` });
    metrics.discoveryUrls.inc({ adapter: seed.source });
  }

  const discovered = await Promise.allSettled(config.discoverySeedDomains.map(discoverCareerUrlsForDomain));
  let count = staticSeeds.length;
  for (const result of discovered) {
    if (result.status !== "fulfilled") {
      logger.warn({ err: result.reason }, "domain discovery failed");
      continue;
    }
    for (const item of result.value) {
      await queues.scrape.add("scrape-url", item, { jobId: `${item.source}:${item.url}` });
      metrics.discoveryUrls.inc({ adapter: item.source });
      count += 1;
    }
  }

  logger.info({ count }, "discovery queued URLs");
};

run().then(() => process.exit(0)).catch((err) => {
  logger.error({ err }, "discovery service failed");
  process.exit(1);
});

