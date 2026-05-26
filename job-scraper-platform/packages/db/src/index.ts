import { ObjectId, MongoClient } from "mongodb";
import { config, logger, NormalizedJob } from "@platform/core";

const client = new MongoClient(config.mongoUri);
const db = client.db();
const jobs = db.collection("jobs");
const failedJobs = db.collection("failed_jobs");
let initialized = false;

const ensureIndexes = async (): Promise<void> => {
  if (initialized) return;
  await jobs.createIndex({ hash: 1 }, { unique: true });
  await jobs.createIndex({ is_active: 1, last_seen: -1 });
  await jobs.createIndex({ company: 1, title: 1 });
  await jobs.createIndex({ remote: 1, posted_at: -1 });
  await jobs.createIndex({ title: "text", description: "text" });
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

