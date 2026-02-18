import { NextResponse } from "next/server";
import { z } from "zod";
import { consumePasswordReset } from "@/lib/email/tokens";
import { actionError, actionSuccess } from "@/lib/errors";
import {
  checkRateLimit,
  clientRateLimitKey,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { passwordSchema } from "@/lib/validators";

const schema = z
  .object({
    token: z.string().min(32).max(200),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export async function POST(request: Request) {
  const limit = await checkRateLimit(
    `reset:${clientRateLimitKey(request)}`,
    6,
    15 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  const parsed = schema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError(
        "VALIDATION_ERROR",
        "Check the password fields.",
        parsed.error.flatten().fieldErrors,
      ),
      { status: 400 },
    );
  try {
    await consumePasswordReset(parsed.data.token, parsed.data.password);
    return NextResponse.json(actionSuccess({ reset: true }));
  } catch {
    return NextResponse.json(
      actionError(
        "INVALID_TOKEN",
        "This reset link is invalid or has expired.",
      ),
      { status: 400 },
    );
  }
}
