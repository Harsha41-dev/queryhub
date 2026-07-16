import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRateLimitProvider, rateLimitResponse } from "@/lib/rate-limit";

describe("rate-limit provider", () => {
  afterEach(() => vi.useRealTimers());

  it("enforces fixed windows, reports retry metadata, and can clear keys", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const provider = new MemoryRateLimitProvider();

    expect((await provider.consume("member", 2, 60_000)).allowed).toBe(true);
    expect((await provider.consume("member", 2, 60_000)).remaining).toBe(0);
    const denied = await provider.consume("member", 2, 60_000);
    expect(denied.allowed).toBe(false);

    const response = rateLimitResponse(denied);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("ratelimit-limit")).toBe("2");
    expect(response.headers.get("ratelimit-remaining")).toBe("0");

    await provider.clear("member");
    expect((await provider.consume("member", 2, 60_000)).allowed).toBe(true);
  });

  it("opens a new counter after the window expires", async () => {
    vi.useFakeTimers();
    const provider = new MemoryRateLimitProvider();
    await provider.consume("search", 1, 1000);
    expect((await provider.consume("search", 1, 1000)).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect((await provider.consume("search", 1, 1000)).allowed).toBe(true);
  });
});
