import { chromium } from "playwright";
import * as cheerio from "cheerio";
import { config, deterministicHash, jitter, logger, NormalizedJob, sleep } from "@platform/core";
export * from "./discovery";

type ScrapeInput = { source: string; url: string; companyHint?: string };

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  "Mozilla/5.0 (X11; Linux x86_64)",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
];

const parseJobsWithCheerio = (html: string, source: string, sourceUrl: string, companyHint?: string): NormalizedJob[] => {
  const $ = cheerio.load(html);
  const jobs: NormalizedJob[] = [];
  $("[data-job], .job, .opening, li").each((_, node) => {
    const title = $(node).find("h2,h3,a").first().text().trim();
    const applyUrl = $(node).find("a").first().attr("href") || sourceUrl;
    if (!title) return;
    const description = $(node).text().trim().slice(0, 4000);
    const company = companyHint || $("meta[property='og:site_name']").attr("content") || "Unknown";
    const locationText = $(node).find(".location,[data-location]").text().trim();
    const normalized: NormalizedJob = {
      source,
      sourceUrl,
      company,
      title,
      description,
      location: locationText || null,
      remote: /remote/i.test(locationText || description),
      salaryMin: null,
      salaryMax: null,
      currency: null,
      tags: [],
      seniority: null,
      employmentType: null,
      postedAt: null,
      scrapedAt: new Date(),
      applyUrl,
      hash: "",
    };
    normalized.hash = deterministicHash(normalized);
    jobs.push(normalized);
  });
  return jobs;
};

export const scrapeUrl = async ({ source, url, companyHint }: ScrapeInput): Promise<NormalizedJob[]> => {
  await sleep(jitter(config.scraperMinDelayMs, config.scraperMaxDelayMs));

  const ua = userAgents[Math.floor(Math.random() * userAgents.length)];
  const response = await fetch(url, { headers: { "user-agent": ua }, signal: AbortSignal.timeout(config.scraperTimeoutMs) });
  const contentType = response.headers.get("content-type") || "";
  const html = await response.text();

  let jobs = parseJobsWithCheerio(html, source, url, companyHint);
  if (jobs.length > 0 && !/text\/html/i.test(contentType)) return jobs;

  if (jobs.length === 0 || /cloudflare|captcha/i.test(html)) {
    logger.warn({ url }, "Cheerio parser empty or blocked; falling back to Playwright");
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext({ userAgent: ua });
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: config.scraperTimeoutMs });
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(800);
      const dynamicHtml = await page.content();
      jobs = parseJobsWithCheerio(dynamicHtml, source, url, companyHint);
      await context.close();
    } finally {
      await browser.close();
    }
  }

  return jobs;
};

