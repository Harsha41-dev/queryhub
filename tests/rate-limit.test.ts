import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryRateLimit, rateLimitResponse } from "@/lib/rate-limit";

describe("rate limit", () => {
  afterEach(() => vi.useRealTimers());

  it("blocks after the limit and returns 429 headers", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const limiter = createMemoryRateLimit();

    expect((await limiter.consume("member", 2, 60_000)).allowed).toBe(true);
    expect((await limiter.consume("member", 2, 60_000)).remaining).toBe(0);
    const denied = await limiter.consume("member", 2, 60_000);
    expect(denied.allowed).toBe(false);

    const response = rateLimitResponse(denied);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("ratelimit-limit")).toBe("2");
    expect(response.headers.get("ratelimit-remaining")).toBe("0");

    await limiter.clear("member");
    expect((await limiter.consume("member", 2, 60_000)).allowed).toBe(true);
  });

  it("starts a new window after time passes", async () => {
    vi.useFakeTimers();
    const limiter = createMemoryRateLimit();
    await limiter.consume("search", 1, 1000);
    expect((await limiter.consume("search", 1, 1000)).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect((await limiter.consume("search", 1, 1000)).allowed).toBe(true);
  });
});
