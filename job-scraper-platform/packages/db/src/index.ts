import { ObjectId, MongoClient } from "mongodb";
import { config, logger, NormalizedJob } from "@platform/core";

const client = new MongoClient(config.mongoUri);
const db = client.db();
const jobs = db.collection("jobs");
const failedJobs = db.collection("failed_jobs");
let initialized = false;

const isIndexOptionsConflict = (e: unknown): boolean => {
  const anyErr = e as { code?: number; codeName?: string } | null;
  return anyErr?.code === 85 || anyErr?.codeName === "IndexOptionsConflict";
};

const ensureIndexes = async (): Promise<void> => {
  if (initialized) return;

  const existing = await jobs.indexes().catch(() => [] as any[]);
  const hasTextIndex = existing.some((idx) => {
    const key = (idx as any)?.key;
    return key && typeof key === "object" && ("_fts" in key || "_ftsx" in key);
  });

  // Some historical/invalid rows may have `hash: null`. A partial unique index
  // avoids startup crashes while still enforcing uniqueness for real hashes.
  await jobs.createIndex(
    { hash: 1 },
    {
      unique: true,
      name: "hash_1_unique",
      partialFilterExpression: { hash: { $type: "string" } },
    },
  );
  await jobs.createIndex({ is_active: 1, last_seen: -1 });
  await jobs.createIndex({ company: 1, title: 1 });
  await jobs.createIndex({ remote: 1, posted_at: -1 });
  // Don't crash if a different text index already exists (common when iterating on schema).
  if (!hasTextIndex) {
    try {
      await jobs.createIndex({ title: "text", company: "text", description: "text" }, { name: "jobs_text_search" });
    } catch (e) {
      if (!isIndexOptionsConflict(e)) throw e;
    }
  }
  await failedJobs.createIndex({ failed_at: -1 });
  initialized = true;
};

const init = async (): Promise<void> => {
  if (!config.mongoUri) throw new Error("MONGODB_URI (or DATABASE_URL) is required");
  await client.connect();
  await ensureIndexes();
};

const initPromise = init();

const normalizeId = (id: string): ObjectId => new ObjectId(id);

export const upsertJob = async (job: NormalizedJob): Promise<string> => {
  await initPromise;
  if (typeof (job as any).hash !== "string" || !(job as any).hash.trim()) {
    throw new Error("job.hash is required (non-empty string)");
  }
  const now = new Date();
  const result = await jobs.findOneAndUpdate(
    { hash: job.hash },
    {
      $set: {
        source: job.source,
        source_url: job.sourceUrl,
        company: job.company,
        title: job.title,
        description: job.description,
        location: job.location,
        remote: job.remote,
        salary_min: job.salaryMin,
        salary_max: job.salaryMax,
        currency: job.currency,
        tags: job.tags,
        seniority: job.seniority,
        employment_type: job.employmentType,
        posted_at: job.postedAt,
        scraped_at: job.scrapedAt,
        apply_url: job.applyUrl,
        last_seen: now,
        is_active: true,
        updated_at: now,
      },
      $setOnInsert: {
        first_seen: now,
        created_at: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  return String(result?._id);
};

export const updateJobEnrichment = async (
  dbId: string,
  payload: { tags: string[]; seniority: string | null; employmentType: string | null; remote: boolean },
): Promise<void> => {
  await initPromise;
  await jobs.updateOne(
    { _id: normalizeId(dbId) },
    {
      $set: {
        tags: payload.tags,
        seniority: payload.seniority,
        employment_type: payload.employmentType,
        remote: payload.remote,
        updated_at: new Date(),
      },
    },
  );
};

export const getJobById = async (dbId: string): Promise<Record<string, unknown> | null> => {
  await initPromise;
  return jobs.findOne({ _id: normalizeId(dbId) });
};

export const listJobsForPublish = async (limit = 25, hoursBack = 24): Promise<Record<string, unknown>[]> => {
  await initPromise;
  const cutoff = new Date(Date.now() - Math.max(1, hoursBack) * 60 * 60 * 1000);
  return jobs
    .find({ is_active: true, updated_at: { $gte: cutoff } })
    .sort({ updated_at: -1 })
    .limit(Math.min(Math.max(Number(limit) || 25, 1), 200))
    .toArray();
};

export const searchActiveJobs = async (q: string): Promise<Record<string, unknown>[]> => {
  await initPromise;
  const query = q.trim()
    ? { is_active: true, $text: { $search: q.trim() } }
    : { is_active: true };
  return jobs.find(query).sort({ posted_at: -1 }).limit(100).toArray();
};

export const markExpiredJobs = async (hoursWithoutSeen = 72): Promise<number> => {
  await initPromise;
  const cutoff = new Date(Date.now() - hoursWithoutSeen * 60 * 60 * 1000);
  const result = await jobs.updateMany(
    { is_active: true, last_seen: { $lt: cutoff } },
    { $set: { is_active: false, updated_at: new Date() } },
  );
  return result.modifiedCount;
};

export const storeFailedJob = async (payload: Record<string, unknown>, error: string): Promise<void> => {
  try {
    await initPromise;
    await failedJobs.insertOne({
      payload,
      error_message: error,
      failed_at: new Date(),
      recovered: false,
    });
  } catch (e) {
    logger.error({ err: e }, "failed to write failed_job row");
  }
};

