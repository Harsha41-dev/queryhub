import "server-only";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type MonitorContext = {
  requestId?: string;
  operation?: string;
  route?: string;
  userId?: string;
  durationMs?: number;
  [key: string]: unknown;
};

type MonitorEvent = {
  kind: "error" | "performance";
  name: string;
  message?: string;
  context: MonitorContext;
  time: string;
};

export interface MonitoringProvider {
  capture(event: MonitorEvent): Promise<void>;
}

class LogMonitoringProvider implements MonitoringProvider {
  async capture(event: MonitorEvent) {
    const level = event.kind === "error" ? "error" : "info";
    logger[level](`monitor.${event.kind}`, {
      name: event.name,
      message: event.message,
      ...event.context,
    });
  }
}

class WebhookMonitoringProvider implements MonitoringProvider {
  async capture(event: MonitorEvent) {
    const response = await fetch(env.MONITORING_WEBHOOK_URL!, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.MONITORING_WEBHOOK_TOKEN
          ? { authorization: `Bearer ${env.MONITORING_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok)
      throw new Error(`Monitoring provider returned ${response.status}`);
  }
}

const provider: MonitoringProvider =
  env.MONITORING_PROVIDER === "webhook"
    ? new WebhookMonitoringProvider()
    : new LogMonitoringProvider();

async function safelyCapture(event: MonitorEvent) {
  try {
    await provider.capture(event);
  } catch (error) {
    logger.error("monitor.delivery_failed", { error });
  }
}

export function captureException(error: unknown, context: MonitorContext = {}) {
  const normalized =
    error instanceof Error ? error : new Error("Unknown error");
  return safelyCapture({
    kind: "error",
    name: normalized.name,
    message: normalized.message,
    context,
    time: new Date().toISOString(),
  });
}

export async function monitorPerformance<T>(
  operation: string,
  task: () => Promise<T>,
  context: MonitorContext = {},
) {
  const startedAt = performance.now();
  try {
    return await task();
  } catch (error) {
    await captureException(error, { ...context, operation });
    throw error;
  } finally {
    void safelyCapture({
      kind: "performance",
      name: operation,
      context: {
        ...context,
        durationMs: Math.round(performance.now() - startedAt),
      },
      time: new Date().toISOString(),
    });
  }
}
