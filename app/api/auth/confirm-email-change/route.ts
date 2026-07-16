import { NextResponse } from "next/server";
import { consumeEmailChange } from "@/lib/email/tokens";
import { checkRateLimit, clientRateLimitKey } from "@/lib/rate-limit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = new URL("/login", url.origin);
  const token = url.searchParams.get("token") ?? "";
  const limit = await checkRateLimit(
    `confirm-email:${clientRateLimitKey(request)}`,
    10,
    15 * 60_000,
  );
  if (!limit.allowed) {
    destination.searchParams.set("emailChange", "rate-limited");
    return NextResponse.redirect(destination);
  }
  try {
    if (token.length < 32 || token.length > 200)
      throw new Error("Invalid token");
    await consumeEmailChange(token);
    destination.searchParams.set("emailChange", "success");
  } catch {
    destination.searchParams.set("emailChange", "invalid");
  }
  return NextResponse.redirect(destination);
}
