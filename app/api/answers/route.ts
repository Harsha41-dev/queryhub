import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getActiveSession } from "@/lib/session";
import { actionError, actionSuccess } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { extractMentionedUsernames } from "@/lib/mentions";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { answerSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to write an answer."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `answer:${session.user.id}`,
    12,
    60 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = answerSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError(
        "VALIDATION_ERROR",
        "Add more detail to your answer.",
        parsed.error.flatten().fieldErrors,
      ),
      { status: 400 },
    );

  try {
    const answer = await prisma.$transaction(async (tx) => {
      const question = await tx.question.findFirst({
        where: { id: parsed.data.questionId, deletedAt: null, isHidden: false },
        select: {
          id: true,
          authorId: true,
          title: true,
          followers: { select: { userId: true } },
        },
      });
      if (!question) throw new Error("QUESTION_NOT_FOUND");

      const created = await tx.answer.create({
        data: {
          questionId: question.id,
          authorId: session.user.id,
          content: parsed.data.content,
        },
        select: { id: true, createdAt: true },
      });

      await tx.question.update({
        where: { id: question.id },
        data: { answerCount: { increment: 1 } },
      });

      // notify question author + followers
      const recipients = new Set(
        question.followers.map((follower) => follower.userId),
      );
      recipients.add(question.authorId);
      recipients.delete(session.user.id);

      if (recipients.size > 0) {
        await tx.notification.createMany({
          data: [...recipients].map((recipientId) => ({
            recipientId,
            actorId: session.user.id,
            questionId: question.id,
            answerId: created.id,
            type: "NEW_ANSWER",
            message: `${session.user.name ?? "Someone"} answered a question you follow`,
          })),
        });
      }

      // @mentions in the answer
      const mentionedUsernames = extractMentionedUsernames(parsed.data.content);
      if (mentionedUsernames.length > 0) {
        const mentionedUsers = await tx.user.findMany({
          where: {
            username: { in: mentionedUsernames },
            id: { not: session.user.id },
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
              questionId: question.id,
              answerId: created.id,
              type: "MENTION" as const,
              message: `${session.user.name ?? "Someone"} mentioned you in an answer`,
            })),
          });
      }

      return created;
    });

    logger.info("answer.created", {
      answerId: answer.id,
      userId: session.user.id,
    });
    return NextResponse.json(actionSuccess(answer), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        actionError(
          "ALREADY_ANSWERED",
          "You already answered this question. Edit your existing answer instead.",
        ),
        { status: 409 },
      );
    if (error instanceof Error && error.message === "QUESTION_NOT_FOUND")
      return NextResponse.json(
        actionError("NOT_FOUND", "That question is no longer available."),
        { status: 404 },
      );
    logger.error("answer.create_failed", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      actionError("INTERNAL_ERROR", "We couldn’t publish your answer."),
      { status: 500 },
    );
  }
}
