import Fastify from "fastify";
import { config, logger, metrics, startTelemetry } from "@platform/core";
import { searchActiveJobs } from "@platform/db";
import { queues } from "@platform/queue";
import { discoverCareerUrlsForDomain } from "@platform/scrapers";

startTelemetry();
const app = Fastify({ logger: false });

app.get("/health", async () => ({ ok: true, service: "api", ts: new Date().toISOString() }));

app.get("/metrics", async (_req, res) => {
  const [scrape, enrich, publish] = await Promise.all([
    queues.scrape.getJobCounts("waiting", "active", "failed", "completed"),
    queues.enrich.getJobCounts("waiting", "active", "failed", "completed"),
    queues.publish.getJobCounts("waiting", "active", "failed", "completed"),
  ]);
  metrics.queueLag.set({ queue: "scrape" }, scrape.waiting ?? 0);
  metrics.queueLag.set({ queue: "enrich" }, enrich.waiting ?? 0);
  metrics.queueLag.set({ queue: "publish" }, publish.waiting ?? 0);
  res.header("content-type", metrics.registry.contentType);
  return res.send(await metrics.registry.metrics());
});

app.get("/queues", async () => ({
  scrape: await queues.scrape.getJobCounts("waiting", "active", "failed", "completed"),
  enrich: await queues.enrich.getJobCounts("waiting", "active", "failed", "completed"),
  publish: await queues.publish.getJobCounts("waiting", "active", "failed", "completed"),
}));

app.get("/jobs", async (req) => {
  const q = (req.query as { q?: string }).q ?? "";
  return searchActiveJobs(q);
});

const staticSeeds = [
  { source: "greenhouse", url: "https://boards.greenhouse.io/embed/job_board?for=airbyte", companyHint: "Airbyte" },
  { source: "lever", url: "https://jobs.lever.co/segment", companyHint: "Segment" },
  { source: "ashby", url: "https://jobs.ashbyhq.com/notion", companyHint: "Notion" },
] as const;

const requireApiKey = (req: { headers: Record<string, unknown> }): void => {
  const key = (req.headers["x-api-key"] as string | undefined) ?? "";
  if (!key || key !== config.websiteApiKey) {
    const err = new Error("unauthorized");
    (err as any).statusCode = 401;
    throw err;
  }
};

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

app.post("/trigger/discovery", async (req) => {
  requireApiKey(req);

  let count = 0;

  for (const seed of staticSeeds) {
    await queues.scrape.add("scrape-url", seed, { jobId: `${seed.source}:${seed.url}` });
    metrics.discoveryUrls.inc({ adapter: seed.source });
    count += 1;
  }

  const domains = config.discoverySeedDomains;
  const results = await mapWithConcurrency(domains, config.discoveryConcurrency, async (domain) => {
    try {
      return { ok: true as const, items: await discoverCareerUrlsForDomain(domain) };
    } catch (err) {
      logger.warn({ err, domain }, "domain discovery failed");
      return { ok: false as const, items: [] as any[] };
    }
  });

  for (const r of results) {
    for (const item of r.items) {
      await queues.scrape.add("scrape-url", item, { jobId: `${item.source}:${item.url}` });
      metrics.discoveryUrls.inc({ adapter: item.source });
      count += 1;
    }
  }

  return { ok: true, queued: count };
});

app.listen({ port: config.apiPort, host: "0.0.0.0" })
  .then(() => logger.info({ port: config.apiPort }, "api started"))
  .catch((err) => {
    logger.error({ err }, "api start failed");
    process.exit(1);
  });

