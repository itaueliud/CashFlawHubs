# Windows Development And Live Deployment

You do not need Docker on Windows to develop or deploy this. Docker is only one packaging option.

## Local Windows Development

Install:

```powershell
cd job-scraper-platform
npm install
npx playwright install chromium
copy .env.example .env
```

For local services, use managed/cloud Redis and Postgres, or install them on Windows:

```powershell
npm --workspace apps/api run dev
npm --workspace apps/scraper-worker run dev
npm --workspace apps/enrichment-worker run dev
npm --workspace apps/publisher run dev
npm --workspace apps/discovery run dev
```

Each command can run in a separate PowerShell tab.

## Live Without Docker

Use managed infrastructure:

- Postgres: Render Postgres, Neon, Supabase, Railway, AWS RDS
- Redis: Render Redis, Upstash Redis, Railway Redis, AWS ElastiCache
- Node services: Render workers, Railway services, Fly.io machines, VPS with PM2

The platform runs as separate Node processes:

- API web service: `npm --workspace apps/api run start`
- Scraper worker: `npm --workspace apps/scraper-worker run start`
- Enrichment worker: `npm --workspace apps/enrichment-worker run start`
- Publisher worker: `npm --workspace apps/publisher run start`
- Discovery cron: `npm --workspace apps/discovery run start` every 30 minutes

Build command:

```bash
npm install
npx playwright install chromium --with-deps
npm run build
```

Start command per service:

```bash
npm --workspace apps/api run start
```

## Environment Variables Needed Live

Set these in your hosting dashboard:

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
WEBSITE_API_BASE_URL=https://your-site.com/api
WEBSITE_API_KEY=strong-secret
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
DISCOVERY_SEED_DOMAINS=company1.com,company2.com
SCRAPER_RESPECT_ROBOTS=true
```

## VPS With PM2

On an Ubuntu server:

```bash
git pull
cd job-scraper-platform
npm install
npx playwright install chromium --with-deps
npm run build
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

Create a cron entry for discovery:

```bash
*/30 * * * * cd /path/to/job-scraper-platform && npm --workspace apps/discovery run start
```

## How It Functions Live

Discovery runs on a schedule and queues career URLs in Redis.
Scraper workers pull from Redis, scrape pages, dedupe into Postgres, and queue enrichment.
Enrichment workers call OpenAI only when cache misses and the circuit breaker is closed.
Publisher workers push jobs to your website API.
The API exposes `/health`, `/metrics`, `/queues`, and searchable `/jobs`.

To scale, increase worker process count or service replicas. The queue absorbs spikes, so the website API does not need to wait for scraping.

