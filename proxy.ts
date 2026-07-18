import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

const protectedPrefixes = [
  "/home",
  "/following",
  "/answer",
  "/bookmarks",
  "/notifications",
  "/settings",
  "/admin",
];

function withRequestId(response: NextResponse, requestId: string) {
  response.headers.set("x-request-id", requestId);
  return response;
}

export default async function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  // always set our own request id (don't trust client headers)
  requestHeaders.set("x-request-id", requestId);

  const pathname = request.nextUrl.pathname;
  const protectedRoute = protectedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (protectedRoute) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    if (!token) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set(
        "callbackUrl",
        `${pathname}${request.nextUrl.search}`,
      );
      return withRequestId(NextResponse.redirect(loginUrl), requestId);
    }
    if (
      pathname.startsWith("/admin") &&
      token.role !== "ADMIN" &&
      token.role !== "MODERATOR"
    )
      return withRequestId(
        NextResponse.redirect(new URL("/home", request.url)),
        requestId,
      );
  }

  return withRequestId(
    NextResponse.next({ request: { headers: requestHeaders } }),
    requestId,
  );
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
