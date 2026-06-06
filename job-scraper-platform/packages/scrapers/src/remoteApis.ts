export interface ScrapedJob {
  title: string;
  company: string;
  description: string;
  applicationUrl: string;
  source: string;
  category: string;
  location?: string;
  remote: boolean;
  tags?: string[];
}

const stripHtml = (value: string): string => String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const parseRssItems = (xml: string): string[] => xml.match(/<item[\s\S]*?<\/item>/g) || [];

const getTagValue = (item: string, tag: string): string => {
  const cdata = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i"))?.[1];
  if (cdata) return cdata;
  const plain = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"))?.[1];
  return plain || "";
};

export async function fetchRemoteOK(): Promise<ScrapedJob[]> {
  const response = await fetch("https://remoteok.com/api", {
    headers: { "user-agent": "CashFlawHubs/1.0 (job aggregator)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return [];

  const data = await response.json().catch(() => []);
  if (!Array.isArray(data)) return [];

  return data.slice(1).map((job: any) => ({
    title: job.position || "",
    company: job.company || "Unknown",
    description: stripHtml(job.description || "").slice(0, 4_000),
    applicationUrl: job.url || "",
    source: "remoteok",
    category: job.tags?.[0] || "Other",
    location: "Remote",
    remote: true,
    tags: Array.isArray(job.tags) ? job.tags : [],
  })).filter((job: ScrapedJob) => Boolean(job.title && job.applicationUrl));
}

export async function fetchRemotive(): Promise<ScrapedJob[]> {
  const response = await fetch("https://remotive.com/api/remote-jobs", {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return [];

  const data = await response.json().catch(() => ({}));
  const jobs = Array.isArray((data as any).jobs) ? (data as any).jobs : [];

  return jobs.map((job: any) => ({
    title: job.title || "",
    company: job.company_name || "Unknown",
    description: stripHtml(job.description || "").slice(0, 4_000),
    applicationUrl: job.url || "",
    source: "remotive",
    category: job.category || "Other",
    location: job.candidate_required_location || "Remote",
    remote: true,
    tags: Array.isArray(job.tags) ? job.tags : [],
  })).filter((job: ScrapedJob) => Boolean(job.title && job.applicationUrl));
}

export async function fetchJobicy(): Promise<ScrapedJob[]> {
  const response = await fetch("https://jobicy.com/?feed=job_feed", {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) return [];

  const xml = await response.text();
  return parseRssItems(xml).map((item) => {
    const title = stripHtml(getTagValue(item, "title"));
    const company = stripHtml(getTagValue(item, "author")) || "Unknown";
    const description = stripHtml(getTagValue(item, "description")).slice(0, 4_000);
    const applicationUrl = stripHtml(getTagValue(item, "link"));

    return {
      title,
      company,
      description,
      applicationUrl,
      source: "jobicy",
      category: "Other",
      location: "Remote",
      remote: true,
      tags: [],
    };
  }).filter((job) => Boolean(job.title && job.applicationUrl));
}

export async function fetchAllRemoteJobs(): Promise<ScrapedJob[]> {
  const results = await Promise.allSettled([fetchRemoteOK(), fetchRemotive(), fetchJobicy()]);
  return results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}
