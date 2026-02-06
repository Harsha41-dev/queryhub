import "server-only";

import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { logger, requestIdFrom } from "@/lib/logger";

export const analyticsEvents = [
  "signup_completed",
  "onboarding_completed",
  "question_created",
  "answer_created",
  "answer_accepted",
  "vote_cast",
  "follow_toggled",
  "bookmark_toggled",
  "search_performed",
  "space_created",
  "space_membership_toggled",
] as const;

export type AnalyticsEventName = (typeof analyticsEvents)[number];
type AnalyticsPrimitive = string | number | boolean | null;
export type AnalyticsProperties = Record<
  string,
  AnalyticsPrimitive | AnalyticsPrimitive[]
>;

const sensitiveAnalyticsKey =
  /email|password|secret|token|cookie|authorization|content|body|message|description|details/i;

function cleanProperties(properties: AnalyticsProperties = {}) {
  const entries: Array<[string, AnalyticsPrimitive | AnalyticsPrimitive[]]> =
    [];

  for (const [key, value] of Object.entries(properties)) {
    if (sensitiveAnalyticsKey.test(key)) continue;
    if (Array.isArray(value)) {
      entries.push([key, value.slice(0, 25)]);
      continue;
    }
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    entries.push([
      key,
      typeof value === "string" ? value.slice(0, 500) : value,
    ]);
  }

  return Object.fromEntries(entries);
}

function anonymousIdFromRequest(request?: Request) {
  if (!request) return undefined;
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  return createHmac("sha256", env.NEXTAUTH_SECRET)
    .update(`${forwarded}|${userAgent}`)
    .digest("hex")
    .slice(0, 32);
}

export async function trackAnalytics(
  event: AnalyticsEventName,
  {
    userId,
    request,
    properties,
  }: {
    userId?: string;
    request?: Request;
    properties?: AnalyticsProperties;
  } = {},
) {
  if (env.ANALYTICS_PROVIDER === "none") return;

  const payload = {
    event,
    service: "queryhub",
    userId,
    anonymousId: userId ? undefined : anonymousIdFromRequest(request),
    requestId: request ? requestIdFrom(request) : undefined,
    timestamp: new Date().toISOString(),
    properties: cleanProperties(properties),
  };

  try {
    if (env.ANALYTICS_PROVIDER === "log") {
      logger.info("analytics.event", payload);
      return;
    }

    if (env.ANALYTICS_PROVIDER === "posthog") {
      const host = (env.POSTHOG_HOST ?? "https://app.posthog.com").replace(
        /\/$/,
        "",
      );
      await fetch(`${host}/capture/`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: env.POSTHOG_PROJECT_API_KEY,
          event,
          distinct_id: payload.userId ?? payload.anonymousId ?? "anonymous",
          properties: {
            ...payload.properties,
            requestId: payload.requestId,
            service: payload.service,
          },
          timestamp: payload.timestamp,
        }),
        signal: AbortSignal.timeout(2500),
        cache: "no-store",
      });
      return;
    }

    if (env.ANALYTICS_WEBHOOK_URL) {
      await fetch(env.ANALYTICS_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(env.ANALYTICS_WEBHOOK_TOKEN
            ? { authorization: `Bearer ${env.ANALYTICS_WEBHOOK_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(2500),
        cache: "no-store",
      });
    }
  } catch (error) {
    logger.warn("analytics.delivery_failed", { event, error });
  }
}
