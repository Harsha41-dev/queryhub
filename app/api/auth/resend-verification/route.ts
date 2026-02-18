import { NextResponse } from "next/server";
import { issueEmailVerification } from "@/lib/email/tokens";
import { actionError, actionSuccess } from "@/lib/errors";
import { captureException } from "@/lib/monitoring";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getActiveSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(actionError("UNAUTHORIZED", "Sign in first."), {
      status: 401,
    });
  const limit = await checkRateLimit(
    `verification:${session.user.id}`,
    3,
    60 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  try {
    await issueEmailVerification(session.user.id);
  } catch (error) {
    await captureException(error, {
      requestId: request.headers.get("x-request-id") ?? undefined,
      operation: "email.verification_request",
      userId: session.user.id,
    });
  }
  return NextResponse.json(
    actionSuccess({ message: "If verification is needed, an email was sent." }),
  );
}
