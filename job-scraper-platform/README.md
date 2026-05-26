# Remote Job Scraping Platform (Production Skeleton)

## Architecture
- `discovery` service: discovers known source URLs (Greenhouse/Lever/Ashby/custom career pages) and enqueues scrape tasks.
- `scraper-worker`: distributed BullMQ consumers; Cheerio-first parsing, Playwright fallback for dynamic/blocking pages.
- `enrichment-worker`: AI/rule enrichment for tags, seniority, employment type, remote detection.
- `publisher`: syncs jobs to website API, handles expiry/inactive propagation.
- `api`: health, metrics, job query endpoints.
- Shared packages:
  - `core`: config, logging, deterministic hash, helpers.
  - `db`: repository-style MongoDB access and dedupe upsert.
  - `queue`: Redis/BullMQ queues, retry/backoff defaults, DLQ.
  - `scrapers`: scraping engines and parser glue.
  - `enrichment`: enrichment module with AI hook.

## Folder Structure
- `apps/api`
- `apps/discovery`
- `apps/scraper-worker`
- `apps/enrichment-worker`
- `apps/publisher`
- `packages/core`
- `packages/db`
- `packages/queue`
- `packages/scrapers`
- `packages/enrichment`
- `infra/docker`
- `docker-compose.yml`

## Setup
1. `cd job-scraper-platform`
2. `copy .env.example .env` (Windows) or `cp .env.example .env`
3. Update `.env` values (DB/Redis/API keys/proxies).
4. Run: `docker compose up --build`

For Windows without Docker, use `docs/WINDOWS-TO-LIVE.md`. The live setup should use managed MongoDB + Redis and separate Node services/workers.

## Production Workflow
1. Discovery pushes URLs to `scrape` queue.
2. Scraper workers fetch + parse jobs and normalize schema.
3. Dedup via deterministic hash + MongoDB upsert (`hash` unique index).
4. Enrichment worker adds tech/seniority/tags.
5. Publisher service pushes create/update events to site API.
6. Expiry job marks stale rows inactive and triggers delete/archive sync.
7. Failures go to `failed_jobs` + DLQ for replay.

## Scaling Strategy
- Horizontal scale by increasing replicas for `scraper-worker`, `enrichment-worker`, `publisher`.
- Partition queues by source or geography when load grows.
- Use dedicated Redis cluster and a managed MongoDB deployment.
- Use browser pools (Playwright context reuse) for heavy JS targets.
- Keep Cheerio path default and Playwright fallback only.

## Retry Strategy
- BullMQ attempts with exponential backoff.
- Terminal failures copied to DLQ.
- `failed_jobs` stores payload/error for replay tooling.

## Security Best Practices
- Store secrets in cloud secret manager, not repo.
- Enforce API auth (`x-api-key` now, signed JWT/HMAC recommended).
- Egress policies and proxy allowlist.
- Strict request timeouts, max body size, and input validation.
- Respect robots and per-domain rate policies when required.

## Anti-Blocking
- User-agent rotation, jitter delays, per-domain limiter.
- Proxy rotation hook via env list.
- Cloudflare/CAPTCHA detection + Playwright escalation path.
- Optional stealth plugins / external captcha-solving hooks.

## Database Optimization Tips
- Keep `hash` unique for O(1) dedupe.
- GIN FTS on title+description for search.
- Partial indexes by `is_active` for live job queries.
- Periodic vacuum/analyze + time-based partitioning at very high scale.

## Deployment
- Kubernetes/ECS with one deployment per service.
- HPA on queue lag and worker CPU.
- Blue/green deploy API; rolling deploy workers.
- Add Prometheus/OpenTelemetry and centralized logs.

## Added Production Modules
- Discovery now parses `robots.txt`, follows sitemap indexes, scans homepage links, and classifies Greenhouse, Lever, Ashby, and generic careers pages.
- Enrichment uses OpenAI JSON responses behind a Redis cache and circuit breaker, then falls back to deterministic rule enrichment if AI is unavailable.
- API exposes Prometheus metrics at `/metrics`, queue JSON at `/queues`, and all services can emit OpenTelemetry traces.
- Kubernetes manifests live in `infra/k8s`, including KEDA queue-lag autoscaling examples.
