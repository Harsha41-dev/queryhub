import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";
import {
  isMutationOriginAllowed,
  isUnsafeMethod,
  originFromUrl,
} from "@/lib/security";

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
  if (
    pathname.startsWith("/api/") &&
    isUnsafeMethod(request.method) &&
    !isMutationOriginAllowed({
      method: request.method,
      requestUrl: request.url,
      origin: request.headers.get("origin"),
      host: request.headers.get("host"),
      forwardedProto: request.headers.get("x-forwarded-proto"),
      secFetchSite: request.headers.get("sec-fetch-site"),
      allowedOrigins: [
        originFromUrl(process.env.APP_URL),
        originFromUrl(process.env.NEXTAUTH_URL),
      ],
    })
  )
    return withRequestId(
      NextResponse.json(
        {
          ok: false,
          error: {
            code: "BAD_ORIGIN",
            message: "Request origin is not allowed.",
          },
        },
        { status: 403 },
      ),
      requestId,
    );

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
