import { NextResponse } from "next/server";
import { z } from "zod";
import { trackAnalytics } from "@/lib/analytics";
import { getActiveSession } from "@/lib/session";
import { sendEmail } from "@/lib/email/provider";
import { followerNotificationEmail } from "@/lib/email/templates";
import { actionError, actionSuccess } from "@/lib/errors";
import { env } from "@/lib/env";
import { captureException } from "@/lib/monitoring";
import { isNotificationMuted } from "@/lib/notification-mutes";
import { recordTopicAffinity } from "@/lib/personalization";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";

const schema = z
  .object({
    userId: z.string().cuid().optional(),
    topicId: z.string().cuid().optional(),
    questionId: z.string().cuid().optional(),
  })
  .refine(
    (data) =>
      [data.userId, data.topicId, data.questionId].filter(Boolean).length === 1,
  );
export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to follow."),
      { status: 401 },
    );
  // follow user / topic / question
  const limit = await checkRateLimit(
    `follow:${session.user.id}`,
    60,
    60 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  const parsed = schema.safeParse(await parseJson(request));
  if (!parsed.success || parsed.data.userId === session.user.id)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a valid item to follow."),
      { status: 400 },
    );
  if (parsed.data.userId) {
    const target = await prisma.user.findFirst({
      where: { id: parsed.data.userId, deletedAt: null, suspendedAt: null },
      select: {
        id: true,
        email: true,
        name: true,
        preference: { select: { emailFollowers: true } },
      },
    });
    if (!target)
      return NextResponse.json(
        actionError("NOT_FOUND", "That user is not available."),
        { status: 404 },
      );
    const key = {
      followerId_followingId: {
        followerId: session.user.id,
        followingId: parsed.data.userId,
      },
    };
    const existing = await prisma.userFollow.findUnique({ where: key });
    const result = await prisma.$transaction(async (tx) => {
      let notificationMuted = false;
      if (existing) await tx.userFollow.delete({ where: key });
      else {
        await tx.userFollow.create({ data: key.followerId_followingId });
        notificationMuted = await isNotificationMuted(tx, parsed.data.userId!, {
          actorId: session.user.id,
        });
        if (!notificationMuted)
          await tx.notification.create({
            data: {
              recipientId: parsed.data.userId!,
              actorId: session.user.id,
              type: "NEW_FOLLOWER",
              message: `${session.user.name ?? "Someone"} started following you`,
            },
          });
      }
      return { notificationMuted };
    });
    if (
      !existing &&
      !result.notificationMuted &&
      target.preference?.emailFollowers === true
    )
      void sendEmail(
        followerNotificationEmail({
          to: target.email,
          name: target.name,
          actor: session.user.name ?? "Someone",
          url: `${env.APP_URL}/profile/${session.user.username}`,
        }),
      ).catch((error) =>
        captureException(error, {
          operation: "email.follower",
          requestId: request.headers.get("x-request-id") ?? undefined,
          userId: target.id,
        }),
      );
    void trackAnalytics("follow_toggled", {
      userId: session.user.id,
      request,
      properties: {
        targetId: parsed.data.userId,
        targetKind: "user",
        following: !existing,
      },
    });
    return NextResponse.json(actionSuccess({ following: !existing }));
  }
  if (parsed.data.topicId) {
    const target = await prisma.topic.findFirst({
      where: { id: parsed.data.topicId, deletedAt: null },
      select: { id: true },
    });
    if (!target)
      return NextResponse.json(
        actionError("NOT_FOUND", "That topic is not available."),
        { status: 404 },
      );
    const key = {
      userId_topicId: { userId: session.user.id, topicId: parsed.data.topicId },
    };
    const existing = await prisma.topicFollow.findUnique({ where: key });
    await prisma.$transaction([
      existing
        ? prisma.topicFollow.delete({ where: key })
        : prisma.topicFollow.create({ data: key.userId_topicId }),
      existing
        ? prisma.topic.updateMany({
            where: { id: parsed.data.topicId, followerCount: { gt: 0 } },
            data: { followerCount: { decrement: 1 } },
          })
        : prisma.topic.update({
            where: { id: parsed.data.topicId },
            data: { followerCount: { increment: 1 } },
          }),
    ]);
    if (!existing)
      void recordTopicAffinity(prisma, {
        userId: session.user.id,
        topicIds: [parsed.data.topicId],
        signal: "follow",
      }).catch(() => undefined);
    void trackAnalytics("follow_toggled", {
      userId: session.user.id,
      request,
      properties: {
        targetId: parsed.data.topicId,
        targetKind: "topic",
        following: !existing,
      },
    });
    return NextResponse.json(actionSuccess({ following: !existing }));
  }
  const target = await prisma.question.findFirst({
    where: {
      id: parsed.data.questionId,
      deletedAt: null,
      isHidden: false,
      mergedIntoId: null,
    },
    select: { id: true, topics: { select: { topicId: true } } },
  });
  if (!target)
    return NextResponse.json(
      actionError("NOT_FOUND", "That question is not available."),
      { status: 404 },
    );
  const key = {
    userId_questionId: {
      userId: session.user.id,
      questionId: parsed.data.questionId!,
    },
  };
  const existing = await prisma.questionFollow.findUnique({ where: key });
  if (existing) await prisma.questionFollow.delete({ where: key });
  else {
    await prisma.questionFollow.create({ data: key.userId_questionId });
    void recordTopicAffinity(prisma, {
      userId: session.user.id,
      topicIds: target.topics.map((topic) => topic.topicId),
      signal: "follow",
    }).catch(() => undefined);
  }
  void trackAnalytics("follow_toggled", {
    userId: session.user.id,
    request,
    properties: {
      targetId: parsed.data.questionId!,
      targetKind: "question",
      following: !existing,
    },
  });
  return NextResponse.json(actionSuccess({ following: !existing }));
}
