import { NextResponse } from "next/server";
import { canActOnRole, canManageUsers } from "@/lib/authorization";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { adminUserSchema } from "@/lib/validators";
import { getActiveSession } from "@/lib/session";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user || !canManageUsers(session.user.role))
    return NextResponse.json(
      actionError("FORBIDDEN", "Moderator access is required."),
      { status: 403 },
    );
  const limit = await checkRateLimit(
    `moderation:${session.user.id}`,
    120,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  const { id } = await params;
  if (id === session.user.id)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "You cannot suspend your own account."),
      { status: 400 },
    );
  const parsed = adminUserSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a valid user action."),
      { status: 400 },
    );
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, role: true, suspendedAt: true },
  });
  if (!user)
    return NextResponse.json(actionError("NOT_FOUND", "User not found."), {
      status: 404,
    });
  if (!canActOnRole(session.user.role, user.role))
    return NextResponse.json(
      actionError("FORBIDDEN", "You cannot moderate an equal or higher role."),
      { status: 403 },
    );
  const suspendedAt = parsed.data.action === "SUSPEND_USER" ? new Date() : null;
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: { suspendedAt, sessionVersion: { increment: 1 } },
      select: { id: true, suspendedAt: true },
    });
    await tx.moderationAction.create({
      data: {
        moderatorId: session.user.id,
        userId: id,
        action: parsed.data.action,
        note: parsed.data.note,
      },
    });
    await tx.notification.create({
      data: {
        recipientId: id,
        actorId: session.user.id,
        type: "MODERATION",
        message: suspendedAt
          ? "Your account was suspended by moderation"
          : "Your account suspension was lifted",
      },
    });
    return updated;
  });
  return NextResponse.json(
    actionSuccess({
      id: result.id,
      status: result.suspendedAt ? "Suspended" : "Active",
    }),
  );
}
