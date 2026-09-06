import "server-only";

import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import { logger, sanitizeForLog } from "@/lib/logger";

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
  const safeContext = sanitizeForLog(context) as MonitorContext;
  const payload = {
    kind: "error" as const,
    name: err.name,
    message: err.message,
    context: safeContext,
    time: new Date().toISOString(),
  };

  logger.error("monitor.error", {
    name: payload.name,
    message: payload.message,
    ...safeContext,
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

  if (env.MONITORING_PROVIDER === "sentry" && env.SENTRY_DSN) {
    try {
      const sentry = sentryEndpointFromDsn(env.SENTRY_DSN);
      if (!sentry) throw new Error("Invalid Sentry DSN");
      await fetch(sentry.endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sentry-auth": [
            "Sentry sentry_version=7",
            `sentry_key=${sentry.publicKey}`,
            "sentry_client=queryhub/1.0",
          ].join(", "),
        },
        body: JSON.stringify({
          event_id: randomUUID().replaceAll("-", ""),
          timestamp: payload.time,
          platform: "javascript",
          logger: "queryhub",
          level: "error",
          environment: env.SENTRY_ENVIRONMENT ?? env.APP_ENV,
          release: env.SENTRY_RELEASE,
          message: err.message,
          exception: {
            values: [{ type: err.name, value: err.message }],
          },
          tags: {
            operation: context.operation,
            route: context.route,
          },
          user: context.userId ? { id: context.userId } : undefined,
          extra: sanitizeForLog({ context, stack: err.stack }),
        }),
        signal: AbortSignal.timeout(3000),
        cache: "no-store",
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
    const safeContext = sanitizeForLog(context) as MonitorContext;
    logger.info("monitor.performance", {
      name: operation,
      durationMs,
      ...safeContext,
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
          context: { ...safeContext, durationMs },
          time: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(3000),
      }).catch((error) => {
        logger.error("monitor.delivery_failed", { error });
      });
    }
  }
}

function sentryEndpointFromDsn(dsn: string) {
  try {
    const url = new URL(dsn);
    const publicKey = url.username;
    const projectId = url.pathname.split("/").filter(Boolean).at(-1);
    if (!url.origin || !publicKey || !projectId) return null;
    return {
      publicKey,
      endpoint: `${url.origin}/api/${projectId}/store/`,
    };
  } catch {
    return null;
  }
}
