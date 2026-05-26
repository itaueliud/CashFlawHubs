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

  const mapWithConcurrency = async <T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> => {
    const limit = Math.max(1, Math.floor(concurrency));
    const out: R[] = new Array(items.length);
    let idx = 0;

    const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (true) {
        const i = idx++;
        if (i >= items.length) return;
        out[i] = await fn(items[i]);
      }
    });

    await Promise.all(runners);
    return out;
  };

  const discovered = await mapWithConcurrency(config.discoverySeedDomains, config.discoveryConcurrency, async (domain) => {
    try {
      return { ok: true as const, items: await discoverCareerUrlsForDomain(domain) };
    } catch (err) {
      return { ok: false as const, err, items: [] as any[] };
    }
  });
  let count = staticSeeds.length;
  for (const result of discovered) {
    if (!result.ok) {
      logger.warn({ err: result.err }, "domain discovery failed");
      continue;
    }
    for (const item of result.items) {
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

