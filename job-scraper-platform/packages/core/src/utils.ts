import crypto from "crypto";
import { NormalizedJob } from "./config";

export const deterministicHash = (job: Pick<NormalizedJob, "source" | "company" | "title" | "location" | "applyUrl">): string => {
  const canonical = [job.source, job.company, job.title, job.location ?? "remote", job.applyUrl]
    .map((v) => v.toLowerCase().trim())
    .join("|");
  return crypto.createHash("sha256").update(canonical).digest("hex");
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const jitter = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;
