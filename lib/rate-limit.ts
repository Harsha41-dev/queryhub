import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { actionError } from "@/lib/errors";
import { logger } from "@/lib/logger";

// fixed-window rate limiting
// local/dev: store counts in memory
// production: use Upstash Redis REST API

type Entry = { count: number; resetAt: number };

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  unavailable?: boolean;
};

// shared map so hot reload in dev doesn't reset counters randomly
const globalStore = globalThis as unknown as {
  queryHubRateLimitStore?: Map<string, Entry>;
};

const memoryStore =
  globalStore.queryHubRateLimitStore ?? new Map<string, Entry>();
if (env.APP_ENV !== "production")
  globalStore.queryHubRateLimitStore = memoryStore;

function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

function memoryConsume(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const existing = memoryStore.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    memoryStore.set(key, { count: 1, resetAt });
    return { allowed: true, limit, remaining: limit - 1, resetAt };
  }
  existing.count += 1;
  return {
    allowed: existing.count <= limit,
    limit,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

function memoryClear(key: string) {
  memoryStore.delete(key);
}

async function upstashCommands(
  commands: Array<Array<string | number>>,
): Promise<Array<{ result?: unknown; error?: string }>> {
  const response = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(2500),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`Upstash rate limit failed: ${response.status}`);
  return (await response.json()) as Array<{
    result?: unknown;
    error?: string;
  }>;
}

function upstashBucketKey(key: string, windowMs: number) {
  const bucket = Math.floor(Date.now() / windowMs);
  return `queryhub:rate:${key}:${bucket}`;
}

async function upstashConsume(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const bucketKey = upstashBucketKey(key, windowMs);
  const results = await upstashCommands([
    ["INCR", bucketKey],
    ["PEXPIRE", bucketKey, windowMs * 2],
  ]);
  const count = Number(results[0]?.result);
  if (!Number.isFinite(count) || results[0]?.error)
    throw new Error("Bad rate limit counter from Upstash");
  const resetAt = (Math.floor(now / windowMs) + 1) * windowMs;
  return {
    allowed: count <= limit,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
  };
}

export async function checkRateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
) {
  const hashed = hashKey(key);
  try {
    if (env.RATE_LIMIT_PROVIDER === "upstash")
      return await upstashConsume(hashed, limit, windowMs);
    return memoryConsume(hashed, limit, windowMs);
  } catch (error) {
    logger.error("rate_limit.failed", { error });
    // in local/dev fall back to memory; in production block the request
    if (env.APP_ENV !== "production")
      return memoryConsume(hashed, limit, windowMs);
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: Date.now() + 5000,
      unavailable: true,
    };
  }
}

export async function clearRateLimit(key: string, windowMs = 60_000) {
  const hashed = hashKey(key);
  try {
    if (env.RATE_LIMIT_PROVIDER === "upstash") {
      await upstashCommands([["DEL", upstashBucketKey(hashed, windowMs)]]);
      return;
    }
    memoryClear(hashed);
  } catch (error) {
    logger.warn("rate_limit.clear_failed", { error });
  }
}

// used when we rate limit anonymous requests by IP
export function clientRateLimitKey(request: Request) {
  if (!env.TRUST_PROXY)
    return env.APP_ENV === "production" ? "untrusted-proxy" : "local";
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const vercel = request.headers
    .get("x-vercel-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return vercel || forwarded || "unknown";
}

export function rateLimitResponse(result: RateLimitResult) {
  const retrySeconds = Math.max(
    1,
    Math.ceil((result.resetAt - Date.now()) / 1000),
  );
  return NextResponse.json(
    actionError(
      "RATE_LIMITED",
      result.unavailable
        ? "Request limiting is temporarily unavailable. Try again shortly."
        : "Too many requests. Try again later.",
    ),
    {
      status: 429,
      headers: {
        "Retry-After": String(retrySeconds),
        "RateLimit-Limit": String(result.limit),
        "RateLimit-Remaining": String(result.remaining),
        "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}

export async function rateLimitHealth() {
  if (env.RATE_LIMIT_PROVIDER !== "upstash") return true;
  try {
    const result = await upstashCommands([["PING"]]);
    return result[0]?.result === "PONG";
  } catch {
    return false;
  }
}

// small helper for unit tests (doesn't use the global hashed keys)
export function createMemoryRateLimit() {
  const store = new Map<string, Entry>();
  return {
    async consume(key: string, limit: number, windowMs: number) {
      const now = Date.now();
      const existing = store.get(key);
      if (!existing || existing.resetAt <= now) {
        const resetAt = now + windowMs;
        store.set(key, { count: 1, resetAt });
        return { allowed: true, limit, remaining: limit - 1, resetAt };
      }
      existing.count += 1;
      return {
        allowed: existing.count <= limit,
        limit,
        remaining: Math.max(0, limit - existing.count),
        resetAt: existing.resetAt,
      };
    },
    async clear(key: string) {
      store.delete(key);
    },
  };
}
