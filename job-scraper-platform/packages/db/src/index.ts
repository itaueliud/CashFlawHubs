import { Pool } from "pg";
import { config, logger, NormalizedJob } from "@platform/core";

export const pool = new Pool({ connectionString: config.databaseUrl, max: 40 });

export const upsertJob = async (job: NormalizedJob): Promise<string> => {
  const q = `
    INSERT INTO jobs (
      source, source_url, company, title, description, location, remote,
      salary_min, salary_max, currency, tags, seniority, employment_type,
      posted_at, scraped_at, apply_url, hash, first_seen, last_seen, is_active
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,
      $8,$9,$10,$11,$12,$13,
      $14,$15,$16,$17, NOW(), NOW(), TRUE
    )
    ON CONFLICT (hash) DO UPDATE SET
      description = EXCLUDED.description,
      location = EXCLUDED.location,
      remote = EXCLUDED.remote,
      salary_min = EXCLUDED.salary_min,
      salary_max = EXCLUDED.salary_max,
      currency = EXCLUDED.currency,
      tags = EXCLUDED.tags,
      seniority = EXCLUDED.seniority,
      employment_type = EXCLUDED.employment_type,
      posted_at = EXCLUDED.posted_at,
      scraped_at = EXCLUDED.scraped_at,
      apply_url = EXCLUDED.apply_url,
      last_seen = NOW(),
      is_active = TRUE
    RETURNING id::text;
  `;

  const values = [
    job.source, job.sourceUrl, job.company, job.title, job.description, job.location, job.remote,
    job.salaryMin, job.salaryMax, job.currency, job.tags, job.seniority, job.employmentType,
    job.postedAt, job.scrapedAt, job.applyUrl, job.hash,
  ];
  const { rows } = await pool.query(q, values);
  return rows[0].id;
};

export const markExpiredJobs = async (hoursWithoutSeen = 72): Promise<number> => {
  const { rowCount } = await pool.query(
    `UPDATE jobs SET is_active = FALSE WHERE is_active = TRUE AND last_seen < NOW() - ($1 || ' hours')::interval`,
    [hoursWithoutSeen],
  );
  return rowCount ?? 0;
};

export const storeFailedJob = async (payload: Record<string, unknown>, error: string): Promise<void> => {
  try {
    await pool.query(
      `INSERT INTO failed_jobs (payload, error_message, failed_at) VALUES ($1, $2, NOW())`,
      [payload, error],
    );
  } catch (e) {
    logger.error({ err: e }, "failed to write failed_job row");
  }
};

