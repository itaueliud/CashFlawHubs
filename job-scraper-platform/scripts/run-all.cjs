/* eslint-disable no-console */
const { spawn } = require("node:child_process");

const PROC_SPECS = [
  { name: "scraper-worker", cmd: "node", args: ["apps/scraper-worker/dist/index.js"] },
  { name: "enrichment-worker", cmd: "node", args: ["apps/enrichment-worker/dist/index.js"] },
  { name: "publisher", cmd: "node", args: ["apps/publisher/dist/index.js"] },
  // Optional: useful for health/metrics locally. On Render Background Workers, ports are not reachable publicly.
  // { name: "api", cmd: "node", args: ["apps/api/dist/index.js"] },
];

const DISCOVERY_CMD = { cmd: "node", args: ["apps/discovery/dist/index.js"] };
const DISCOVERY_INTERVAL_MS = Number(process.env.DISCOVERY_INTERVAL_MS || 30 * 60 * 1000);

const children = new Map();
let stopping = false;

const parseWorkerRoles = () => {
  // Low-memory deploy tip:
  // - Set `WORKER_ROLES=scraper-worker` (or `publisher`, `enrichment-worker`, `discovery`)
  // - Leave it empty locally to run everything.
  const raw = String(process.env.WORKER_ROLES || "").trim();
  if (!raw) return { roles: PROC_SPECS.map((s) => s.name), discovery: true };

  const roles = new Set(
    raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );

  const wantsAll = roles.has("all") || roles.has("*");
  if (wantsAll) return { roles: PROC_SPECS.map((s) => s.name), discovery: true };

  const discovery = roles.has("discovery");
  const selected = PROC_SPECS.map((s) => s.name).filter((name) => roles.has(name));
  return { roles: selected, discovery };
};

const startChild = (spec) => {
  const child = spawn(spec.cmd, spec.args, {
    stdio: "inherit",
    env: process.env,
  });
  children.set(spec.name, child);

  child.on("exit", (code, signal) => {
    children.delete(spec.name);
    if (stopping) return;
    console.error(`[run-all] ${spec.name} exited (code=${code}, signal=${signal}). Restarting in 2s...`);
    setTimeout(() => startChild(spec), 2000);
  });
};

const runDiscoveryOnce = () =>
  new Promise((resolve) => {
    const child = spawn(DISCOVERY_CMD.cmd, DISCOVERY_CMD.args, { stdio: "inherit", env: process.env });
    child.on("exit", () => resolve());
  });

const shutdown = async () => {
  if (stopping) return;
  stopping = true;
  console.error("[run-all] shutting down...");

  for (const [, child] of children) {
    try { child.kill("SIGTERM"); } catch {}
  }
  setTimeout(() => process.exit(0), 10_000).unref();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const selection = parseWorkerRoles();
for (const spec of PROC_SPECS) {
  if (selection.roles.includes(spec.name)) startChild(spec);
}

if (selection.discovery) {
  // Kickoff immediately, then on interval.
  runDiscoveryOnce()
    .catch(() => {})
    .finally(() => {
      setInterval(() => { void runDiscoveryOnce(); }, DISCOVERY_INTERVAL_MS).unref();
    });
}
