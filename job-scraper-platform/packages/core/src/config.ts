import "dotenv/config";

const asNum = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  logLevel: process.env.LOG_LEVEL ?? "info",
  mongoUri: process.env.MONGODB_URI ?? process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "",
  queuePrefix: process.env.QUEUE_PREFIX ?? "remotejobs",
  apiPort: asNum(process.env.API_PORT, 8080),
  websiteApiBaseUrl: process.env.WEBSITE_API_BASE_URL ?? "http://localhost:5000/api",
  websiteApiKey: process.env.WEBSITE_API_KEY ?? "dev-scraper-key",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  scrapeConcurrency: asNum(process.env.QUEUE_SCRAPE_CONCURRENCY, 20),
  enrichConcurrency: asNum(process.env.QUEUE_ENRICH_CONCURRENCY, 30),
  publishConcurrency: asNum(process.env.QUEUE_PUBLISH_CONCURRENCY, 20),
  scraperGlobalRps: asNum(process.env.SCRAPER_GLOBAL_RPS, 4),
  scraperTimeoutMs: asNum(process.env.SCRAPER_REQUEST_TIMEOUT_MS, 30000),
  scraperRetryAttempts: asNum(process.env.SCRAPER_RETRY_ATTEMPTS, 6),
  scraperMinDelayMs: asNum(process.env.SCRAPER_MIN_DELAY_MS, 500),
  scraperMaxDelayMs: asNum(process.env.SCRAPER_MAX_DELAY_MS, 2500),
  scraperUseProxies: String(process.env.SCRAPER_USE_PROXIES ?? "false") === "true",
  scraperProxies: (process.env.SCRAPER_PROXY_LIST ?? "").split(",").map((p) => p.trim()).filter(Boolean),
  scraperRespectRobots: String(process.env.SCRAPER_RESPECT_ROBOTS ?? "true") === "true",
  scraperUsePlaywright: String(process.env.SCRAPER_USE_PLAYWRIGHT ?? "false") === "true",
  discoverySeedDomains: (process.env.DISCOVERY_SEED_DOMAINS ?? "").split(",").map((d) => d.trim()).filter(Boolean),
  discoveryMaxSitemapUrls: asNum(process.env.DISCOVERY_MAX_SITEMAP_URLS, 5000),
  discoveryConcurrency: asNum(process.env.DISCOVERY_CONCURRENCY, 8),
  enrichmentCacheTtlSeconds: asNum(process.env.ENRICHMENT_CACHE_TTL_SECONDS, 60 * 60 * 24 * 30),
  enrichmentBreakerTimeoutMs: asNum(process.env.ENRICHMENT_BREAKER_TIMEOUT_MS, 12000),
  enrichmentBreakerErrorThreshold: asNum(process.env.ENRICHMENT_BREAKER_ERROR_THRESHOLD, 50),
  enrichmentBreakerResetMs: asNum(process.env.ENRICHMENT_BREAKER_RESET_MS, 30000),
  otelServiceName: process.env.OTEL_SERVICE_NAME ?? "remote-job-scraper",
  otelExporterOtlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "",
};

export type NormalizedJob = {
  id?: string;
  source: string;
  sourceUrl: string;
  company: string;
  title: string;
  description: string;
  location: string | null;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  tags: string[];
  seniority: string | null;
  employmentType: string | null;
  postedAt: Date | null;
  scrapedAt: Date;
  applyUrl: string;
  hash: string;
};
