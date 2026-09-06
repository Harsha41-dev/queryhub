import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assessUserText, recentDuplicateWindow } from "@/lib/abuse";
import { trackAnalytics } from "@/lib/analytics";
import { evaluateUserBadges } from "@/lib/badges";
import { getActiveSession } from "@/lib/session";
import { extractMarkdownImageUrls } from "@/lib/content-images";
import { sendEmail } from "@/lib/email/provider";
import { newAnswerEmail } from "@/lib/email/templates";
import { actionError, actionSuccess } from "@/lib/errors";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { extractMentionedUsernames } from "@/lib/mentions";
import { captureException } from "@/lib/monitoring";
import { filterNotificationRecipients } from "@/lib/notification-mutes";
import { recordTopicAffinity } from "@/lib/personalization";
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

  const abuse = assessUserText(parsed.data.content, { maxLinks: 12 });
  if (!abuse.ok)
    return NextResponse.json(actionError(abuse.code, abuse.message), {
      status: 400,
    });

  const recentDuplicate = await prisma.answer.findFirst({
    where: {
      authorId: session.user.id,
      questionId: { not: parsed.data.questionId },
      content: parsed.data.content,
      deletedAt: null,
      createdAt: { gte: recentDuplicateWindow(24) },
    },
    select: { id: true },
  });
  if (recentDuplicate)
    return NextResponse.json(
      actionError(
        "DUPLICATE_CONTENT",
        "You recently posted this exact answer. Rewrite it for this question.",
      ),
      { status: 409 },
    );

  try {
    const answer = await prisma.$transaction(async (tx) => {
      const question = await tx.question.findFirst({
        where: {
          id: parsed.data.questionId,
          deletedAt: null,
          isHidden: false,
          mergedIntoId: null,
        },
        select: {
          id: true,
          slug: true,
          authorId: true,
          author: {
            select: {
              id: true,
              email: true,
              name: true,
              preference: { select: { emailAnswers: true } },
            },
          },
          title: true,
          followers: {
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  preference: { select: { emailAnswers: true } },
                },
              },
            },
          },
          topics: { select: { topicId: true } },
        },
      });
      if (!question) throw new Error("QUESTION_NOT_FOUND");
      if (parsed.data.credentialId) {
        const credential = await tx.userCredential.findFirst({
          where: {
            id: parsed.data.credentialId,
            userId: session.user.id,
          },
          select: { id: true },
        });
        if (!credential) throw new Error("CREDENTIAL_NOT_FOUND");
      }

      const created = await tx.answer.create({
        data: {
          questionId: question.id,
          authorId: session.user.id,
          credentialId: parsed.data.credentialId,
          content: parsed.data.content,
        },
        select: { id: true, createdAt: true },
      });
      const imageUrls = extractMarkdownImageUrls(parsed.data.content);
      if (imageUrls.length)
        await tx.mediaAttachment.updateMany({
          where: {
            userId: session.user.id,
            questionId: null,
            answerId: null,
            url: { in: imageUrls },
          },
          data: { answerId: created.id },
        });

      await tx.question.update({
        where: { id: question.id },
        data: { answerCount: { increment: 1 } },
      });
      await tx.answerRequest.updateMany({
        where: {
          questionId: question.id,
          requestedUserId: session.user.id,
          status: "PENDING",
        },
        data: { status: "ANSWERED", answeredAt: new Date() },
      });
      const topicIds = question.topics.map((topic) => topic.topicId);
      await recordTopicAffinity(tx, {
        userId: session.user.id,
        topicIds,
        signal: "answer",
      });

      // notify question author + followers
      const recipientUsers = new Map<
        string,
        {
          id: string;
          email: string;
          name: string;
          preference: { emailAnswers: boolean } | null;
        }
      >();
      for (const follower of question.followers)
        recipientUsers.set(follower.user.id, follower.user);
      recipientUsers.set(question.author.id, question.author);
      recipientUsers.delete(session.user.id);

      const notificationRecipients = await filterNotificationRecipients(
        tx,
        [...recipientUsers.keys()],
        { actorId: session.user.id, topicIds },
      );
      const notificationRecipientSet = new Set(notificationRecipients);

      if (notificationRecipients.length > 0) {
        await tx.notification.createMany({
          data: notificationRecipients.map((recipientId) => ({
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
        const mentionRecipients = await filterNotificationRecipients(
          tx,
          mentionedUsers.map((user) => user.id),
          { actorId: session.user.id, topicIds },
        );
        if (mentionRecipients.length > 0)
          await tx.notification.createMany({
            data: mentionRecipients.map((recipientId) => ({
              recipientId,
              actorId: session.user.id,
              questionId: question.id,
              answerId: created.id,
              type: "MENTION" as const,
              message: `${session.user.name ?? "Someone"} mentioned you in an answer`,
            })),
          });
      }

      return {
        ...created,
        question: {
          slug: question.slug,
          title: question.title,
        },
        topicIds,
        emailRecipients: [...recipientUsers.values()].filter(
          (user) =>
            notificationRecipientSet.has(user.id) &&
            user.preference?.emailAnswers !== false,
        ),
      };
    });

    for (const recipient of answer.emailRecipients)
      void sendEmail(
        newAnswerEmail({
          to: recipient.email,
          name: recipient.name,
          actor: session.user.name ?? "Someone",
          question: answer.question.title,
          url: `${env.APP_URL}/question/${answer.question.slug}#answer-${answer.id}`,
        }),
      ).catch((error) =>
        captureException(error, {
          operation: "email.new_answer",
          requestId: request.headers.get("x-request-id") ?? undefined,
          userId: recipient.id,
        }),
      );

    logger.info("answer.created", {
      answerId: answer.id,
      userId: session.user.id,
    });
    void evaluateUserBadges(session.user.id, {
      topicIds: answer.topicIds,
    }).catch(() => undefined);
    void trackAnalytics("answer_created", {
      userId: session.user.id,
      request,
      properties: {
        answerId: answer.id,
        questionId: parsed.data.questionId,
        hasCredential: Boolean(parsed.data.credentialId),
      },
    });
    return NextResponse.json(
      actionSuccess({ id: answer.id, createdAt: answer.createdAt }),
      { status: 201 },
    );
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
    if (error instanceof Error && error.message === "CREDENTIAL_NOT_FOUND")
      return NextResponse.json(
        actionError("VALIDATION_ERROR", "Choose one of your credentials."),
        { status: 400 },
      );
    logger.error("answer.create_failed", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      actionError("INTERNAL_ERROR", "We could not publish your answer."),
      { status: 500 },
    );
  }
}
