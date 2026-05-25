module.exports = {
  apps: [
    {
      name: "job-scraper-api",
      cwd: __dirname,
      script: "apps/api/dist/index.js",
      instances: 2,
      exec_mode: "cluster",
    },
    {
      name: "job-scraper-worker",
      cwd: __dirname,
      script: "apps/scraper-worker/dist/index.js",
      instances: 3,
    },
    {
      name: "job-enrichment-worker",
      cwd: __dirname,
      script: "apps/enrichment-worker/dist/index.js",
      instances: 2,
    },
    {
      name: "job-publisher",
      cwd: __dirname,
      script: "apps/publisher/dist/index.js",
      instances: 2,
    },
  ],
};

