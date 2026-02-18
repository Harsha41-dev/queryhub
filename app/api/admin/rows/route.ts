import { NextResponse } from "next/server";
import { adminOptionsFromUrl } from "@/lib/admin-options";
import { canManageUsers, canModerate, hasRole } from "@/lib/authorization";
import { actionError, actionSuccess } from "@/lib/errors";
import { getAdminRowsPage } from "@/lib/query-data";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getActiveSession } from "@/lib/session";

const kinds = ["users", "content", "reports", "topics"] as const;
type Kind = (typeof kinds)[number];

function isKind(value: string | null): value is Kind {
  return Boolean(value && kinds.includes(value as Kind));
}

export async function GET(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to view admin data."),
      { status: 401 },
    );

  const kind = new URL(request.url).searchParams.get("kind");
  if (!isKind(kind))
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a valid admin table."),
      { status: 400 },
    );

  if (kind === "users" && !canManageUsers(session.user.role))
    return NextResponse.json(actionError("FORBIDDEN", "Forbidden."), {
      status: 403,
    });
  if (kind === "topics" && !hasRole(session.user.role, "ADMIN"))
    return NextResponse.json(actionError("FORBIDDEN", "Forbidden."), {
      status: 403,
    });
  if (
    (kind === "content" || kind === "reports") &&
    !canModerate(session.user.role)
  )
    return NextResponse.json(actionError("FORBIDDEN", "Forbidden."), {
      status: 403,
    });

  const limit = await checkRateLimit(
    `admin-rows:${session.user.id}`,
    120,
    60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const page = await getAdminRowsPage(kind, {
    ...adminOptionsFromUrl(request.url),
    actorId: session.user.id,
    actorRole: session.user.role,
  });
  return NextResponse.json(actionSuccess(page));
}
