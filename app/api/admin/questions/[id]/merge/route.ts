import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { canActOnRole, canModerate } from "@/lib/authorization";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { getActiveSession } from "@/lib/session";
import { questionMergeSchema } from "@/lib/validators";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user || !canModerate(session.user.role))
    return NextResponse.json(
      actionError("FORBIDDEN", "Moderator access is required."),
      { status: 403 },
    );

  const limit = await checkRateLimit(
    `question-merge:${session.user.id}`,
    60,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const { id: sourceQuestionId } = await params;
  const parsed = questionMergeSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a target question."),
      { status: 400 },
    );
  if (sourceQuestionId === parsed.data.targetQuestionId)
    return NextResponse.json(
      actionError(
        "VALIDATION_ERROR",
        "A question cannot be merged into itself.",
      ),
      { status: 400 },
    );

  try {
    // Keep the whole merge atomic so answers, follows, bookmarks, and the
    // source question never end up pointing at different final questions.
    const result = await prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.question.findFirst({
          where: { id: sourceQuestionId, deletedAt: null },
          include: {
            author: { select: { role: true } },
            topics: { select: { topicId: true } },
            followers: { select: { userId: true, createdAt: true } },
            bookmarks: {
              where: { answerId: null },
              select: { userId: true, collectionId: true, createdAt: true },
            },
            answerRequests: {
              where: { status: "PENDING" },
              select: {
                requesterId: true,
                requestedUserId: true,
                message: true,
                createdAt: true,
              },
            },
            spaceLinks: {
              select: {
                spaceId: true,
                submittedById: true,
                approvedById: true,
                status: true,
                createdAt: true,
              },
            },
            _count: { select: { answers: true } },
          },
        }),
        tx.question.findFirst({
          where: {
            id: parsed.data.targetQuestionId,
            deletedAt: null,
            isHidden: false,
            mergedIntoId: null,
          },
          include: {
            topics: { select: { topicId: true } },
            followers: { select: { userId: true } },
            bookmarks: {
              where: { answerId: null },
              select: { userId: true },
            },
            answerRequests: {
              select: { requestedUserId: true },
            },
            spaceLinks: { select: { spaceId: true } },
          },
        }),
      ]);
      if (!source || !target) throw new Error("NOT_FOUND");
      if (source.mergedIntoId) throw new Error("ALREADY_MERGED");
      if (!canActOnRole(session.user.role, source.author.role))
        throw new Error("ROLE_FORBIDDEN");

      // Copy only relations that the target does not already have.
      const targetTopicIds = new Set(
        target.topics.map((topic) => topic.topicId),
      );
      const topicLinks = source.topics.filter(
        (topic) => !targetTopicIds.has(topic.topicId),
      );
      if (topicLinks.length)
        await tx.questionTopic.createMany({
          data: topicLinks.map((topic) => ({
            questionId: target.id,
            topicId: topic.topicId,
          })),
          skipDuplicates: true,
        });

      const targetFollowers = new Set(
        target.followers.map((follower) => follower.userId),
      );
      const followerLinks = source.followers.filter(
        (follower) => !targetFollowers.has(follower.userId),
      );
      if (followerLinks.length)
        await tx.questionFollow.createMany({
          data: followerLinks.map((follower) => ({
            userId: follower.userId,
            questionId: target.id,
            createdAt: follower.createdAt,
          })),
          skipDuplicates: true,
        });

      const targetBookmarks = new Set(
        target.bookmarks.map((bookmark) => bookmark.userId),
      );
      const bookmarkLinks = source.bookmarks.filter(
        (bookmark) => !targetBookmarks.has(bookmark.userId),
      );
      if (bookmarkLinks.length)
        await tx.bookmark.createMany({
          data: bookmarkLinks.map((bookmark) => ({
            userId: bookmark.userId,
            questionId: target.id,
            collectionId: bookmark.collectionId,
            createdAt: bookmark.createdAt,
          })),
          skipDuplicates: true,
        });

      const targetRequestUsers = new Set(
        target.answerRequests.map((request) => request.requestedUserId),
      );
      const answerRequestLinks = source.answerRequests.filter(
        (item) => !targetRequestUsers.has(item.requestedUserId),
      );
      if (answerRequestLinks.length)
        await tx.answerRequest.createMany({
          data: answerRequestLinks.map((item) => ({
            questionId: target.id,
            requesterId: item.requesterId,
            requestedUserId: item.requestedUserId,
            message: item.message,
            createdAt: item.createdAt,
          })),
          skipDuplicates: true,
        });

      const targetSpaces = new Set(
        target.spaceLinks.map((link) => link.spaceId),
      );
      const spaceLinks = source.spaceLinks.filter(
        (link) => !targetSpaces.has(link.spaceId),
      );
      if (spaceLinks.length)
        await tx.spaceQuestion.createMany({
          data: spaceLinks.map((link) => ({
            spaceId: link.spaceId,
            questionId: target.id,
            submittedById: link.submittedById,
            approvedById: link.approvedById,
            status: link.status,
            createdAt: link.createdAt,
          })),
          skipDuplicates: true,
        });

      // Move child content and then hide the source as a merged duplicate.
      await Promise.all([
        tx.answer.updateMany({
          where: { questionId: source.id },
          data: { questionId: target.id },
        }),
        tx.answerRequest.updateMany({
          where: { questionId: source.id, status: "PENDING" },
          data: { status: "DISMISSED" },
        }),
        tx.notification.updateMany({
          where: { questionId: source.id },
          data: { questionId: target.id },
        }),
        tx.questionFollow.deleteMany({ where: { questionId: source.id } }),
        tx.bookmark.deleteMany({
          where: { questionId: source.id, answerId: null },
        }),
        tx.question.update({
          where: { id: source.id },
          data: {
            mergedIntoId: target.id,
            isHidden: true,
            acceptedAnswerId: null,
            answerCount: 0,
          },
        }),
        tx.question.update({
          where: { id: target.id },
          data: { answerCount: { increment: source._count.answers } },
        }),
        tx.moderationAction.create({
          data: {
            moderatorId: session.user.id,
            questionId: source.id,
            action: "HIDE_CONTENT",
            note:
              parsed.data.note ??
              `Merged duplicate question into "${target.title}".`,
          },
        }),
      ]);

      if (source.authorId !== session.user.id)
        await tx.notification.create({
          data: {
            recipientId: source.authorId,
            actorId: session.user.id,
            questionId: target.id,
            type: "MODERATION",
            message:
              "Your duplicate question was merged into an existing thread",
          },
        });

      return {
        id: source.id,
        status: "Merged",
        targetQuestionId: target.id,
        targetSlug: target.slug,
      };
    });

    return NextResponse.json(actionSuccess(result));
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND")
      return NextResponse.json(
        actionError("NOT_FOUND", "Source or target question was not found."),
        { status: 404 },
      );
    if (error instanceof Error && error.message === "ALREADY_MERGED")
      return NextResponse.json(
        actionError("CONFLICT", "This question is already merged."),
        { status: 409 },
      );
    if (error instanceof Error && error.message === "ROLE_FORBIDDEN")
      return NextResponse.json(
        actionError(
          "FORBIDDEN",
          "You cannot merge content owned by an equal or higher role.",
        ),
        { status: 403 },
      );
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    )
      return NextResponse.json(
        actionError("NOT_FOUND", "Source or target question was not found."),
        { status: 404 },
      );
    throw error;
  }
}
