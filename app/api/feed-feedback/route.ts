import { NextResponse } from "next/server";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { getActiveSession } from "@/lib/session";
import { feedFeedbackSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to personalize your feed."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `feed-feedback:${session.user.id}`,
    60,
    60 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = feedFeedbackSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a valid feed preference."),
      { status: 400 },
    );

  if (parsed.data.authorId === session.user.id)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "You cannot mute yourself."),
      { status: 400 },
    );

  const target = parsed.data.questionId
    ? await prisma.question.findFirst({
        where: { id: parsed.data.questionId, deletedAt: null },
        select: { id: true },
      })
    : parsed.data.authorId
      ? await prisma.user.findFirst({
          where: {
            id: parsed.data.authorId,
            deletedAt: null,
            suspendedAt: null,
          },
          select: { id: true },
        })
      : await prisma.topic.findFirst({
          where: { id: parsed.data.topicId, deletedAt: null },
          select: { id: true },
        });

  if (!target)
    return NextResponse.json(
      actionError("NOT_FOUND", "That feed item is no longer available."),
      { status: 404 },
    );

  const feedback = await prisma.$transaction(async (tx) => {
    const saved = await tx.feedFeedback.upsert({
      where: parsed.data.questionId
        ? {
            userId_questionId_type: {
              userId: session.user.id,
              questionId: parsed.data.questionId,
              type: parsed.data.type,
            },
          }
        : parsed.data.authorId
          ? {
              userId_authorId_type: {
                userId: session.user.id,
                authorId: parsed.data.authorId,
                type: parsed.data.type,
              },
            }
          : {
              userId_topicId_type: {
                userId: session.user.id,
                topicId: parsed.data.topicId!,
                type: parsed.data.type,
              },
            },
      create: { userId: session.user.id, ...parsed.data },
      update: {},
      select: { id: true, type: true },
    });

    if (parsed.data.type === "MUTE_USER" && parsed.data.authorId)
      await tx.notificationMute.upsert({
        where: {
          userId_targetType_targetId: {
            userId: session.user.id,
            targetType: "USER",
            targetId: parsed.data.authorId,
          },
        },
        create: {
          userId: session.user.id,
          targetType: "USER",
          targetId: parsed.data.authorId,
        },
        update: {},
      });

    if (parsed.data.type === "NOT_INTERESTED_TOPIC" && parsed.data.topicId)
      await tx.notificationMute.upsert({
        where: {
          userId_targetType_targetId: {
            userId: session.user.id,
            targetType: "TOPIC",
            targetId: parsed.data.topicId,
          },
        },
        create: {
          userId: session.user.id,
          targetType: "TOPIC",
          targetId: parsed.data.topicId,
        },
        update: {},
      });

    return saved;
  });

  return NextResponse.json(actionSuccess(feedback), { status: 201 });
}
