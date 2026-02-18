import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { getActiveSession } from "@/lib/session";
import { notificationMuteSchema } from "@/lib/validators";

export async function PATCH(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to manage notifications."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `notification-mutes:${session.user.id}`,
    60,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = notificationMuteSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose one source to update."),
      { status: 400 },
    );

  const { targetUserId, topicId, muted } = parsed.data;
  if (targetUserId === session.user.id)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "You cannot mute your own alerts."),
      { status: 400 },
    );

  const target = targetUserId
    ? await prisma.user.findFirst({
        where: { id: targetUserId, deletedAt: null, suspendedAt: null },
        select: { id: true },
      })
    : topicId
      ? await prisma.topic.findFirst({
          where: { id: topicId, deletedAt: null },
          select: { id: true },
        })
      : null;
  if (!target)
    return NextResponse.json(
      actionError(
        "NOT_FOUND",
        "That notification source is no longer available.",
      ),
      { status: 404 },
    );

  try {
    if (muted && targetUserId)
      await prisma.notificationMute.upsert({
        where: {
          userId_targetType_targetId: {
            userId: session.user.id,
            targetType: "USER",
            targetId: targetUserId,
          },
        },
        create: {
          userId: session.user.id,
          targetType: "USER",
          targetId: targetUserId,
        },
        update: {},
      });
    else if (muted && topicId)
      await prisma.notificationMute.upsert({
        where: {
          userId_targetType_targetId: {
            userId: session.user.id,
            targetType: "TOPIC",
            targetId: topicId,
          },
        },
        create: {
          userId: session.user.id,
          targetType: "TOPIC",
          targetId: topicId,
        },
        update: {},
      });
    else
      await prisma.notificationMute.deleteMany({
        where: {
          userId: session.user.id,
          targetType: targetUserId ? "USER" : "TOPIC",
          targetId: targetUserId ?? topicId!,
        },
      });

    return NextResponse.json(actionSuccess({ targetUserId, topicId, muted }));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        actionSuccess({ targetUserId, topicId, muted: true }),
      );
    return NextResponse.json(
      actionError(
        "INTERNAL_ERROR",
        "Notification source could not be updated.",
      ),
      { status: 500 },
    );
  }
}
