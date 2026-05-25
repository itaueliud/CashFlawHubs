import Fastify from "fastify";
import { config, logger, metrics, startTelemetry } from "@platform/core";
import { pool } from "@platform/db";
import { queues } from "@platform/queue";

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
  const { rows } = await pool.query(
    `SELECT id, company, title, location, remote, tags, posted_at, is_active
     FROM jobs
     WHERE is_active = TRUE AND (to_tsvector('english', title || ' ' || description) @@ plainto_tsquery('english', $1) OR $1 = '')
     ORDER BY posted_at DESC NULLS LAST
     LIMIT 100`,
    [q],
  );
  return rows;
});

app.post("/trigger/discovery", async () => {
  await queues.discovery.add("kickoff", { triggeredAt: Date.now() });
  return { ok: true };
});

app.listen({ port: config.apiPort, host: "0.0.0.0" })
  .then(() => logger.info({ port: config.apiPort }, "api started"))
  .catch((err) => {
    logger.error({ err }, "api start failed");
    process.exit(1);
  });

