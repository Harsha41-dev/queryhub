import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/session";
import { actionError, actionSuccess } from "@/lib/errors";
import { extractMentionedUsernames } from "@/lib/mentions";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { commentSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to comment."),
      { status: 401 },
    );
  // max 30 comments per hour per user
  const limit = await checkRateLimit(
    `comment:${session.user.id}`,
    30,
    60 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  const parsed = commentSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Check your comment."),
      { status: 400 },
    );
  const answer = await prisma.answer.findFirst({
    where: { id: parsed.data.answerId, deletedAt: null, isHidden: false },
    select: { id: true, authorId: true, questionId: true },
  });
  if (!answer)
    return NextResponse.json(
      actionError("NOT_FOUND", "That answer is no longer available."),
      { status: 404 },
    );
  const parent = parsed.data.parentId
    ? await prisma.comment.findFirst({
        where: { id: parsed.data.parentId, deletedAt: null, isHidden: false },
        select: { depth: true, answerId: true, authorId: true },
      })
    : null;
  if (parsed.data.parentId && !parent)
    return NextResponse.json(
      actionError("NOT_FOUND", "Parent comment not found."),
      { status: 404 },
    );
  if (parent && (parent.answerId !== parsed.data.answerId || parent.depth >= 3))
    return NextResponse.json(
      actionError("DEPTH_LIMIT", "Replies can be nested up to three levels."),
      { status: 400 },
    );
  const comment = await prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        answerId: parsed.data.answerId,
        authorId: session.user.id,
        parentId: parsed.data.parentId,
        content: parsed.data.content,
        depth: parent ? parent.depth + 1 : 0,
      },
      select: { id: true, content: true, createdAt: true },
    });
    await tx.answer.update({
      where: { id: parsed.data.answerId },
      data: { commentCount: { increment: 1 } },
    });
    const recipientId = parent?.authorId ?? answer.authorId;
    if (recipientId !== session.user.id) {
      await tx.notification.create({
        data: {
          recipientId,
          actorId: session.user.id,
          questionId: answer.questionId,
          answerId: answer.id,
          commentId: created.id,
          type: parent ? "REPLY" : "COMMENT",
          message: parent
            ? `${session.user.name ?? "Someone"} replied to your comment`
            : `${session.user.name ?? "Someone"} commented on your answer`,
        },
      });
    }
    const mentionedUsernames = extractMentionedUsernames(parsed.data.content);
    if (mentionedUsernames.length > 0) {
      const mentionedUsers = await tx.user.findMany({
        where: {
          username: { in: mentionedUsernames },
          id: { notIn: [session.user.id, recipientId] },
          deletedAt: null,
          suspendedAt: null,
        },
        select: { id: true },
        take: 10,
      });
      if (mentionedUsers.length > 0)
        await tx.notification.createMany({
          data: mentionedUsers.map((user) => ({
            recipientId: user.id,
            actorId: session.user.id,
            questionId: answer.questionId,
            answerId: answer.id,
            commentId: created.id,
            type: "MENTION" as const,
            message: `${session.user.name ?? "Someone"} mentioned you in a comment`,
          })),
        });
    }
    return created;
  });
  return NextResponse.json(actionSuccess(comment), { status: 201 });
}
