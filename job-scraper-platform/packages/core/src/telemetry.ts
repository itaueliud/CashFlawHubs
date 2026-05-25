import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import client from "prom-client";
import { config } from "./config";
import { logger } from "./logger";

let sdk: NodeSDK | null = null;

export const metrics = {
  registry: new client.Registry(),
  scrapedJobs: new client.Counter({
    name: "jobs_scraped_total",
    help: "Total normalized jobs scraped",
    labelNames: ["source"],
  }),
  publishedJobs: new client.Counter({
    name: "jobs_published_total",
    help: "Total jobs published to the website API",
  }),
  discoveryUrls: new client.Counter({
    name: "discovery_urls_total",
    help: "Total discovered URLs queued for scraping",
    labelNames: ["adapter"],
  }),
  aiEnrichmentCalls: new client.Counter({
    name: "ai_enrichment_calls_total",
    help: "OpenAI enrichment calls by result",
    labelNames: ["result"],
  }),
  queueLag: new client.Gauge({
    name: "bullmq_queue_waiting_jobs",
    help: "Waiting jobs per BullMQ queue",
    labelNames: ["queue"],
  }),
};

metrics.registry.setDefaultLabels({ service: config.otelServiceName });
metrics.registry.registerMetric(metrics.scrapedJobs);
metrics.registry.registerMetric(metrics.publishedJobs);
metrics.registry.registerMetric(metrics.discoveryUrls);
metrics.registry.registerMetric(metrics.aiEnrichmentCalls);
metrics.registry.registerMetric(metrics.queueLag);
client.collectDefaultMetrics({ register: metrics.registry });

export const startTelemetry = () => {
  if (sdk) return;

  sdk = new NodeSDK({
    serviceName: config.otelServiceName,
    traceExporter: config.otelExporterOtlpEndpoint
      ? new OTLPTraceExporter({ url: config.otelExporterOtlpEndpoint })
      : undefined,
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();
  logger.info({ service: config.otelServiceName }, "telemetry started");
};

