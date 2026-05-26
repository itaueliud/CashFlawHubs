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
let cycleMode = false;
let currentCycleRole = null;
const expectedExits = new Set();

const parseWorkerRoles = () => {
  // Low-memory deploy tip:
  // - Set `WORKER_ROLES=scraper-worker` (or `publisher`, `enrichment-worker`, `discovery`)
  // - Leave it empty locally to run everything.
  const raw = String(process.env.WORKER_ROLES || "").trim();
  if (!raw) return { roles: PROC_SPECS.map((s) => s.name), discovery: true };

  if (raw.toLowerCase().startsWith("cycle:")) {
    const list = raw.slice("cycle:".length);
    const roles = list
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    return { cycle: true, roles, discovery: false };
  }

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
    if (expectedExits.has(spec.name)) {
      expectedExits.delete(spec.name);
      return;
    }
    if (cycleMode && currentCycleRole && spec.name !== currentCycleRole) {
      // In cycle mode we never want "background" restarts for roles that are not active.
      return;
    }
    console.error(`[run-all] ${spec.name} exited (code=${code}, signal=${signal}). Restarting in 2s...`);
    setTimeout(() => startChild(spec), 2000);
  });
};

const stopChild = (name) => {
  const child = children.get(name);
  if (!child) return;
  expectedExits.add(name);
  try { child.kill("SIGTERM"); } catch {}
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const SPEC_BY_NAME = new Map(PROC_SPECS.map((s) => [s.name, s]));

if (selection.cycle) {
  cycleMode = true;
  const minutes = Number(process.env.WORKER_CYCLE_MINUTES || 10);
  const phaseMs = Math.max(1, minutes) * 60_000;

  const cycleRoles = selection.roles.map((name) => name.trim()).filter(Boolean);

  if (cycleRoles.length === 0) {
    console.error("[run-all] WORKER_ROLES cycle has no valid roles; exiting.");
    process.exit(1);
  }

  (async () => {
    // Never run multiple roles at the same time (keeps memory low).
    while (!stopping) {
      for (const roleName of cycleRoles) {
        if (stopping) break;
        currentCycleRole = roleName;

        if (roleName === "discovery") {
          console.error("[run-all] cycle running discovery once...");
          await runDiscoveryOnce().catch(() => {});
          currentCycleRole = null;
          await sleep(2000);
          continue;
        }

        const spec = SPEC_BY_NAME.get(roleName);
        if (!spec) {
          console.error(`[run-all] cycle role '${roleName}' is unknown; skipping.`);
          currentCycleRole = null;
          await sleep(1000);
          continue;
        }

        console.error(`[run-all] cycle starting ${roleName} for ${minutes}m...`);
        startChild(spec);
        await sleep(phaseMs);
        console.error(`[run-all] cycle stopping ${roleName}...`);
        stopChild(roleName);
        currentCycleRole = null;
        // Give Node a moment to exit and release resources.
        await sleep(2000);
      }
    }
  })().catch(() => process.exit(1));
} else {
  for (const spec of PROC_SPECS) {
    if (selection.roles.includes(spec.name)) startChild(spec);
  }
}

if (selection.discovery) {
  // Kickoff immediately, then on interval.
  runDiscoveryOnce()
    .catch(() => {})
    .finally(() => {
      setInterval(() => { void runDiscoveryOnce(); }, DISCOVERY_INTERVAL_MS).unref();
    });
}
