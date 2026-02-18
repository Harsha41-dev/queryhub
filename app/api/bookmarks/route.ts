import { NextResponse } from "next/server";
import { z } from "zod";
import { trackAnalytics } from "@/lib/analytics";
import { getActiveSession } from "@/lib/session";
import { actionError, actionSuccess } from "@/lib/errors";
import { recordTopicAffinity } from "@/lib/personalization";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";

const schema = z
  .object({
    questionId: z.string().cuid().optional(),
    answerId: z.string().cuid().optional(),
    collectionId: z.string().cuid().nullable().optional(),
  })
  .refine((value) => Boolean(value.questionId) !== Boolean(value.answerId));
export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to save posts."),
      { status: 401 },
    );
  // toggle bookmark on a question or answer
  const limit = await checkRateLimit(
    `bookmark:${session.user.id}`,
    60,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  const parsed = schema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose one item to bookmark."),
      { status: 400 },
    );
  const exists = parsed.data.questionId
    ? await prisma.question.findFirst({
        where: {
          id: parsed.data.questionId,
          deletedAt: null,
          isHidden: false,
          mergedIntoId: null,
        },
        select: { id: true },
      })
    : await prisma.answer.findFirst({
        where: {
          id: parsed.data.answerId,
          deletedAt: null,
          isHidden: false,
          question: { deletedAt: null, isHidden: false, mergedIntoId: null },
        },
        select: { id: true },
      });
  if (!exists)
    return NextResponse.json(
      actionError("NOT_FOUND", "That item is no longer available."),
      { status: 404 },
    );
  if (parsed.data.collectionId) {
    const collection = await prisma.bookmarkCollection.findFirst({
      where: { id: parsed.data.collectionId, userId: session.user.id },
      select: { id: true },
    });
    if (!collection)
      return NextResponse.json(
        actionError("NOT_FOUND", "That collection was not found."),
        { status: 404 },
      );
  }
  const { collectionId, ...target } = parsed.data;
  const targetId = parsed.data.questionId ?? parsed.data.answerId!;
  const targetKind = parsed.data.questionId ? "question" : "answer";
  const topicIds = parsed.data.questionId
    ? (
        await prisma.questionTopic.findMany({
          where: { questionId: parsed.data.questionId },
          select: { topicId: true },
        })
      ).map((topic) => topic.topicId)
    : (
        (
          await prisma.answer.findUnique({
            where: { id: parsed.data.answerId! },
            select: {
              question: { select: { topics: { select: { topicId: true } } } },
            },
          })
        )?.question.topics ?? []
      ).map((topic) => topic.topicId);
  const existing = await prisma.bookmark.findFirst({
    where: { userId: session.user.id, ...target },
  });
  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    void trackAnalytics("bookmark_toggled", {
      userId: session.user.id,
      request,
      properties: {
        targetId,
        targetKind,
        bookmarked: false,
      },
    });
    return NextResponse.json(actionSuccess({ bookmarked: false }));
  }
  await prisma.bookmark.create({
    data: { userId: session.user.id, ...target, collectionId },
  });
  void recordTopicAffinity(prisma, {
    userId: session.user.id,
    topicIds,
    signal: "bookmark",
  }).catch(() => undefined);
  void trackAnalytics("bookmark_toggled", {
    userId: session.user.id,
    request,
    properties: {
      targetId,
      targetKind,
      bookmarked: true,
      hasCollection: Boolean(collectionId),
    },
  });
  return NextResponse.json(actionSuccess({ bookmarked: true }), {
    status: 201,
  });
}
