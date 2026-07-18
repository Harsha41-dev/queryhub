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

// log errors (and optionally POST them to a webhook in production)
export async function captureException(
  error: unknown,
  context: MonitorContext = {},
) {
  const err = error instanceof Error ? error : new Error("Unknown error");
  const payload = {
    kind: "error" as const,
    name: err.name,
    message: err.message,
    context,
    time: new Date().toISOString(),
  };

  logger.error("monitor.error", {
    name: payload.name,
    message: payload.message,
    ...context,
  });

  if (env.MONITORING_PROVIDER === "webhook" && env.MONITORING_WEBHOOK_URL) {
    try {
      const response = await fetch(env.MONITORING_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(env.MONITORING_WEBHOOK_TOKEN
            ? { authorization: `Bearer ${env.MONITORING_WEBHOOK_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok)
        logger.error("monitor.delivery_failed", {
          status: response.status,
        });
    } catch (deliveryError) {
      logger.error("monitor.delivery_failed", { error: deliveryError });
    }
  }
}

// time a task and log how long it took
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
    const durationMs = Math.round(performance.now() - startedAt);
    logger.info("monitor.performance", {
      name: operation,
      durationMs,
      ...context,
    });

    if (env.MONITORING_PROVIDER === "webhook" && env.MONITORING_WEBHOOK_URL) {
      void fetch(env.MONITORING_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(env.MONITORING_WEBHOOK_TOKEN
            ? { authorization: `Bearer ${env.MONITORING_WEBHOOK_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          kind: "performance",
          name: operation,
          context: { ...context, durationMs },
          time: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(3000),
      }).catch((error) => {
        logger.error("monitor.delivery_failed", { error });
      });
    }
  }
}
