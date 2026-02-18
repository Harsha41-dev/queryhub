import { NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/lib/email/tokens";
import { actionSuccess } from "@/lib/errors";
import { captureException } from "@/lib/monitoring";
import {
  checkRateLimit,
  clientRateLimitKey,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";

const response = actionSuccess({
  message: "If an account exists, recovery instructions will be sent shortly.",
});

export async function POST(request: Request) {
  const limit = await checkRateLimit(
    `forgot:${clientRateLimitKey(request)}`,
    4,
    15 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  const parsed = z
    .object({ email: z.string().trim().email().toLowerCase() })
    .safeParse(await parseJson(request));
  if (!parsed.success) return NextResponse.json(response);
  try {
    await requestPasswordReset(parsed.data.email);
  } catch (error) {
    await captureException(error, {
      requestId: request.headers.get("x-request-id") ?? undefined,
      operation: "email.password_reset_request",
    });
  }
  return NextResponse.json(response);
}
