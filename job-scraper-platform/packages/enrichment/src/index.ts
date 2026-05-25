import CircuitBreaker from "opossum";
import OpenAI from "openai";
import { config, deterministicHash, logger, metrics, NormalizedJob } from "@platform/core";
import { redis } from "@platform/queue";

type EnrichmentResult = {
  techStack: string[];
  categories: string[];
  seniority: string | null;
  employmentType: string | null;
  remote: boolean;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string | null;
  seoSummary: string;
};

const openai = config.openAiApiKey ? new OpenAI({ apiKey: config.openAiApiKey }) : null;

const enrichWithOpenAI = async (job: NormalizedJob): Promise<EnrichmentResult> => {
  if (!openai) throw new Error("OpenAI is not configured");

  const response = await openai.chat.completions.create({
    model: config.openAiModel,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Extract structured job metadata. Return strict JSON with techStack, categories, seniority, employmentType, remote, salaryMin, salaryMax, currency, seoSummary.",
      },
      {
        role: "user",
        content: JSON.stringify({
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.description.slice(0, 12000),
        }),
      },
    ],
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("empty OpenAI enrichment response");
  return JSON.parse(content) as EnrichmentResult;
};

const breaker = new CircuitBreaker(enrichWithOpenAI, {
  timeout: config.enrichmentBreakerTimeoutMs,
  errorThresholdPercentage: config.enrichmentBreakerErrorThreshold,
  resetTimeout: config.enrichmentBreakerResetMs,
});

breaker.on("open", () => logger.warn("OpenAI enrichment circuit opened"));
breaker.on("halfOpen", () => logger.warn("OpenAI enrichment circuit half-open"));
breaker.on("close", () => logger.info("OpenAI enrichment circuit closed"));

export const enrichJob = async (job: NormalizedJob): Promise<NormalizedJob> => {
  const text = `${job.title} ${job.description}`.toLowerCase();
  const inferredTags = ["node.js", "react", "python", "aws", "kubernetes"].filter((t) => text.includes(t.replace(".", "")) || text.includes(t));
  const seniority = job.seniority ?? (/senior/.test(text) ? "senior" : /junior/.test(text) ? "junior" : null);
  const employmentType = job.employmentType ?? (/contract/.test(text) ? "contract" : /full[- ]?time/.test(text) ? "full-time" : null);

  let aiTags: string[] = [];
  let aiResult: EnrichmentResult | null = null;
  const cacheKey = `enrichment:${deterministicHash({ ...job, applyUrl: job.applyUrl })}`;

  if (config.openAiApiKey) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      aiResult = JSON.parse(cached) as EnrichmentResult;
      metrics.aiEnrichmentCalls.inc({ result: "cache_hit" });
    } else {
      try {
        aiResult = await breaker.fire(job) as EnrichmentResult;
        await redis.set(cacheKey, JSON.stringify(aiResult), "EX", config.enrichmentCacheTtlSeconds);
        metrics.aiEnrichmentCalls.inc({ result: "success" });
      } catch (err) {
        metrics.aiEnrichmentCalls.inc({ result: "fallback" });
        logger.warn({ err, job: job.hash }, "AI enrichment failed; using rule fallback");
      }
    }
  }

  if (aiResult) aiTags = [...aiResult.techStack, ...aiResult.categories].filter(Boolean);

  return {
    ...job,
    tags: Array.from(new Set([...job.tags, ...inferredTags, ...aiTags])),
    seniority: aiResult?.seniority ?? seniority,
    employmentType: aiResult?.employmentType ?? employmentType,
    remote: aiResult?.remote ?? (job.remote || /remote/.test(text)),
    salaryMin: aiResult?.salaryMin ?? job.salaryMin,
    salaryMax: aiResult?.salaryMax ?? job.salaryMax,
    currency: aiResult?.currency ?? job.currency,
    description: aiResult?.seoSummary ? `${job.description}\n\nSEO Summary: ${aiResult.seoSummary}` : job.description,
  };
};
