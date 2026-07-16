import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { emailHealth } from "@/lib/email/provider";
import { env } from "@/lib/env";
import { logger, requestIdFrom } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { rateLimitHealth } from "@/lib/rate-limit";
import { objectStorage } from "@/lib/storage/provider";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const supplied = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  if (!supplied) return false;
  const actual = Buffer.from(env.READINESS_TOKEN);
  const candidate = Buffer.from(supplied);
  return (
    actual.length === candidate.length && timingSafeEqual(actual, candidate)
  );
}

export async function GET(request: Request) {
  if (!authorized(request))
    return NextResponse.json(
      { status: "not_found" },
      { status: 404, headers: { "cache-control": "no-store" } },
    );

  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    rateLimitHealth(),
    objectStorage().health(),
    emailHealth(),
  ]);
  const ready = checks.every(
    (result) => result.status === "fulfilled" && result.value !== false,
  );
  if (!ready)
    logger.error("readiness.failed", {
      requestId: requestIdFrom(request),
      checks: checks.map((result) =>
        result.status === "fulfilled" ? Boolean(result.value) : false,
      ),
    });
  return NextResponse.json(
    { status: ready ? "ready" : "not_ready" },
    {
      status: ready ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
