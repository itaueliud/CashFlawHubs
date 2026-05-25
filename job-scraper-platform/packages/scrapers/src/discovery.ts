import * as cheerio from "cheerio";
import { config, logger } from "@platform/core";

export type DiscoveredUrl = {
  source: "greenhouse" | "lever" | "ashby" | "career_site";
  url: string;
  companyHint?: string;
  reason: string;
};

type RobotsInfo = {
  sitemaps: string[];
  disallowed: string[];
};

const atsMatchers: Array<{ source: DiscoveredUrl["source"]; pattern: RegExp }> = [
  { source: "greenhouse", pattern: /boards\.greenhouse\.io|greenhouse\.io\/embed\/job_board/i },
  { source: "lever", pattern: /jobs\.lever\.co/i },
  { source: "ashby", pattern: /jobs\.ashbyhq\.com/i },
];

const careerHints = [
  /\/careers?(\/|$)/i,
  /\/jobs?(\/|$)/i,
  /\/open-positions?(\/|$)/i,
  /\/join-us(\/|$)/i,
  /\/work-with-us(\/|$)/i,
];

const fetchText = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    headers: { "user-agent": "RemoteJobScraperBot/1.0 (+jobs discovery)" },
    signal: AbortSignal.timeout(config.scraperTimeoutMs),
  });
  if (!response.ok) throw new Error(`fetch failed ${response.status} for ${url}`);
  return response.text();
};

const normalizeUrl = (base: string, href: string): string | null => {
  try {
    return new URL(href, base).toString().split("#")[0];
  } catch {
    return null;
  }
};

export const parseRobots = (robotsTxt: string): RobotsInfo => {
  const sitemaps: string[] = [];
  const disallowed: string[] = [];
  for (const rawLine of robotsTxt.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^sitemap$/i.test(key)) sitemaps.push(value);
    if (/^disallow$/i.test(key) && value) disallowed.push(value);
  }
  return { sitemaps, disallowed };
};

export const allowedByRobots = (url: string, robots: RobotsInfo): boolean => {
  if (!config.scraperRespectRobots) return true;
  const path = new URL(url).pathname;
  return !robots.disallowed.some((rule) => rule !== "/" && path.startsWith(rule));
};

export const discoverFromSitemap = async (sitemapUrl: string): Promise<string[]> => {
  const xml = await fetchText(sitemapUrl);
  const $ = cheerio.load(xml, { xmlMode: true });
  const nested = $("sitemap loc").map((_, el) => $(el).text().trim()).get();
  if (nested.length) {
    const childResults = await Promise.allSettled(nested.slice(0, 25).map(discoverFromSitemap));
    return childResults.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  }
  return $("url loc").map((_, el) => $(el).text().trim()).get().slice(0, config.discoveryMaxSitemapUrls);
};

export const classifyDiscoveredUrl = (url: string, companyHint?: string): DiscoveredUrl | null => {
  for (const matcher of atsMatchers) {
    if (matcher.pattern.test(url)) return { source: matcher.source, url, companyHint, reason: "ats" };
  }
  if (careerHints.some((hint) => hint.test(new URL(url).pathname))) {
    return { source: "career_site", url, companyHint, reason: "career-hint" };
  }
  return null;
};

export const discoverCareerUrlsForDomain = async (domain: string): Promise<DiscoveredUrl[]> => {
  const origin = domain.startsWith("http") ? new URL(domain).origin : `https://${domain}`;
  const robotsUrl = `${origin}/robots.txt`;
  let robots: RobotsInfo = { sitemaps: [`${origin}/sitemap.xml`], disallowed: [] };

  try {
    robots = parseRobots(await fetchText(robotsUrl));
    if (robots.sitemaps.length === 0) robots.sitemaps.push(`${origin}/sitemap.xml`);
  } catch (err) {
    logger.warn({ domain, err }, "robots unavailable; trying default sitemap");
  }

  const urls = new Set<string>();
  for (const sitemap of robots.sitemaps.slice(0, 10)) {
    const result = await Promise.allSettled([discoverFromSitemap(sitemap)]);
    for (const item of result) {
      if (item.status === "fulfilled") item.value.forEach((url) => urls.add(url));
    }
  }

  const homeHtml = await fetchText(origin).catch(() => "");
  if (homeHtml) {
    const $ = cheerio.load(homeHtml);
    $("a[href]").each((_, el) => {
      const normalized = normalizeUrl(origin, $(el).attr("href") || "");
      if (normalized) urls.add(normalized);
    });
  }

  return Array.from(urls)
    .filter((url) => allowedByRobots(url, robots))
    .map((url) => classifyDiscoveredUrl(url, new URL(origin).hostname.replace(/^www\./, "")))
    .filter((item): item is DiscoveredUrl => Boolean(item));
};

