import "server-only";

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { actionError } from "@/lib/errors";
import { logger } from "@/lib/logger";

type Entry = { count: number; resetAt: number };

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  unavailable?: boolean;
};

export interface RateLimitProvider {
  consume(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult>;
  clear(key: string, windowMs: number): Promise<void>;
  health(): Promise<boolean>;
}

export class MemoryRateLimitProvider implements RateLimitProvider {
  private readonly store = new Map<string, Entry>();

  async consume(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const existing = this.store.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      this.store.set(key, { count: 1, resetAt });
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

  async clear(key: string) {
    this.store.delete(key);
  }

  async health() {
    return true;
  }
}

class UpstashRateLimitProvider implements RateLimitProvider {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private bucketKey(key: string, windowMs: number) {
    const bucket = Math.floor(Date.now() / windowMs);
    return `queryhub:rate:${key}:${bucket}`;
  }

  private async commands(commands: Array<Array<string | number>>) {
    const response = await fetch(`${this.url}/pipeline`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(2500),
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(`Rate-limit provider returned ${response.status}`);
    return (await response.json()) as Array<{
      result?: unknown;
      error?: string;
    }>;
  }

  async consume(key: string, limit: number, windowMs: number) {
    const now = Date.now();
    const bucketKey = this.bucketKey(key, windowMs);
    const results = await this.commands([
      ["INCR", bucketKey],
      ["PEXPIRE", bucketKey, windowMs * 2],
    ]);
    const count = Number(results[0]?.result);
    if (!Number.isFinite(count) || results[0]?.error)
      throw new Error("Rate-limit provider returned an invalid counter");
    const resetAt = (Math.floor(now / windowMs) + 1) * windowMs;
    return {
      allowed: count <= limit,
      limit,
      remaining: Math.max(0, limit - count),
      resetAt,
    };
  }

  async clear(key: string, windowMs: number) {
    await this.commands([["DEL", this.bucketKey(key, windowMs)]]);
  }

  async health() {
    try {
      const result = await this.commands([["PING"]]);
      return result[0]?.result === "PONG";
    } catch {
      return false;
    }
  }
}

const globalProviders = globalThis as unknown as {
  queryHubMemoryRateLimiter?: MemoryRateLimitProvider;
  queryHubRateLimiterOverride?: RateLimitProvider;
};

const memoryProvider =
  globalProviders.queryHubMemoryRateLimiter ?? new MemoryRateLimitProvider();
if (env.APP_ENV !== "production")
  globalProviders.queryHubMemoryRateLimiter = memoryProvider;

function provider() {
  if (globalProviders.queryHubRateLimiterOverride)
    return globalProviders.queryHubRateLimiterOverride;
  if (env.RATE_LIMIT_PROVIDER === "upstash")
    return new UpstashRateLimitProvider(
      env.UPSTASH_REDIS_REST_URL!,
      env.UPSTASH_REDIS_REST_TOKEN!,
    );
  return memoryProvider;
}

function opaqueKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export async function checkRateLimit(
  key: string,
  limit = 20,
  windowMs = 60_000,
) {
  try {
    return await provider().consume(opaqueKey(key), limit, windowMs);
  } catch (error) {
    logger.error("rate_limit.provider_failed", { error });
    if (env.APP_ENV !== "production")
      return memoryProvider.consume(opaqueKey(key), limit, windowMs);
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
  try {
    await provider().clear(opaqueKey(key), windowMs);
  } catch (error) {
    logger.warn("rate_limit.clear_failed", { error });
  }
}

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
  return provider().health();
}

export function setRateLimitProviderForTests(value?: RateLimitProvider) {
  if (env.APP_ENV === "production")
    throw new Error("Provider overrides are test-only");
  globalProviders.queryHubRateLimiterOverride = value;
}
