import { NextResponse } from "next/server";
import { consumeEmailVerification, safeRedirectPath } from "@/lib/email/tokens";
import { checkRateLimit, clientRateLimitKey } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const callback = safeRedirectPath(
    url.searchParams.get("callbackUrl"),
    "/login",
  );
  const destination = new URL(callback, url.origin);
  const token = url.searchParams.get("token") ?? "";
  const limit = await checkRateLimit(
    `verify-email:${clientRateLimitKey(request)}`,
    10,
    15 * 60_000,
  );
  if (!limit.allowed) {
    destination.searchParams.set("emailVerification", "rate-limited");
    return NextResponse.redirect(destination);
  }
  try {
    if (token.length < 32 || token.length > 200)
      throw new Error("Invalid token");
    await consumeEmailVerification(token);
    destination.searchParams.set("emailVerification", "success");
  } catch {
    destination.searchParams.set("emailVerification", "invalid");
  }
  return NextResponse.redirect(destination);
}
