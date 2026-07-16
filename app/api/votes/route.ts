import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getActiveSession } from "@/lib/session";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { voteSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(actionError("UNAUTHORIZED", "Sign in to vote."), {
      status: 401,
    });
  const limit = await checkRateLimit(
    `vote:${session.user.id}`,
    120,
    60 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  const parsed = voteSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid vote.",
      ),
      { status: 400 },
    );
  const { questionId, answerId, commentId, value } = parsed.data;
  const target = questionId
    ? { kind: "question" as const, id: questionId }
    : answerId
      ? { kind: "answer" as const, id: answerId }
      : { kind: "comment" as const, id: commentId! };
  const idField = `${target.kind}Id` as "questionId" | "answerId" | "commentId";
  let recipientId: string;
  let notificationTarget: {
    questionId?: string;
    answerId?: string;
    commentId?: string;
  };
  if (target.kind === "question") {
    const item = await prisma.question.findFirst({
      where: { id: target.id, deletedAt: null, isHidden: false },
      select: { id: true, authorId: true },
    });
    if (!item)
      return NextResponse.json(
        actionError("NOT_FOUND", "That item is no longer available."),
        { status: 404 },
      );
    recipientId = item.authorId;
    notificationTarget = { questionId: item.id };
  } else if (target.kind === "answer") {
    const item = await prisma.answer.findFirst({
      where: {
        id: target.id,
        deletedAt: null,
        isHidden: false,
        question: { deletedAt: null, isHidden: false },
      },
      select: { id: true, authorId: true, questionId: true },
    });
    if (!item)
      return NextResponse.json(
        actionError("NOT_FOUND", "That item is no longer available."),
        { status: 404 },
      );
    recipientId = item.authorId;
    notificationTarget = { answerId: item.id, questionId: item.questionId };
  } else {
    const item = await prisma.comment.findFirst({
      where: {
        id: target.id,
        deletedAt: null,
        isHidden: false,
        answer: { deletedAt: null, isHidden: false },
      },
      select: {
        id: true,
        authorId: true,
        answerId: true,
        answer: { select: { questionId: true } },
      },
    });
    if (!item)
      return NextResponse.json(
        actionError("NOT_FOUND", "That item is no longer available."),
        { status: 404 },
      );
    recipientId = item.authorId;
    notificationTarget = {
      commentId: item.id,
      answerId: item.answerId,
      questionId: item.answer.questionId,
    };
  }

  const run = async (
    attempt = 0,
  ): Promise<{ score: number; vote: -1 | 0 | 1 }> => {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const existing = await tx.vote.findFirst({
            where: { userId: session.user.id, [idField]: target.id },
          });
          const oldValue =
            existing?.value === "UP" ? 1 : existing?.value === "DOWN" ? -1 : 0;
          if (value === 0) {
            if (existing) await tx.vote.delete({ where: { id: existing.id } });
          } else if (existing)
            await tx.vote.update({
              where: { id: existing.id },
              data: { value: value === 1 ? "UP" : "DOWN" },
            });
          else
            await tx.vote.create({
              data: {
                userId: session.user.id,
                [idField]: target.id,
                value: value === 1 ? "UP" : "DOWN",
              },
            });
          const delta = value - oldValue;
          const updated =
            target.kind === "question"
              ? await tx.question.update({
                  where: { id: target.id },
                  data: { score: { increment: delta } },
                  select: { score: true },
                })
              : target.kind === "answer"
                ? await tx.answer.update({
                    where: { id: target.id },
                    data: { score: { increment: delta } },
                    select: { score: true },
                  })
                : await tx.comment.update({
                    where: { id: target.id },
                    data: { score: { increment: delta } },
                    select: { score: true },
                  });
          if (
            value === 1 &&
            oldValue !== 1 &&
            recipientId !== session.user.id
          ) {
            const notified = await tx.notification.findFirst({
              where: {
                recipientId,
                actorId: session.user.id,
                type: "UPVOTE",
                ...notificationTarget,
              },
              select: { id: true },
            });
            if (!notified)
              await tx.notification.create({
                data: {
                  recipientId,
                  actorId: session.user.id,
                  type: "UPVOTE",
                  message: `${session.user.name ?? "Someone"} upvoted your contribution`,
                  ...notificationTarget,
                },
              });
          }
          return { score: updated.score, vote: value };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        attempt === 0 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2002", "P2034"].includes(error.code)
      )
        return run(1);
      throw error;
    }
  };
  const result = await run();
  return NextResponse.json(actionSuccess(result));
}
