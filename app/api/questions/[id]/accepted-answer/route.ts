import { NextResponse } from "next/server";
import { trackAnalytics } from "@/lib/analytics";
import { sendEmail } from "@/lib/email/provider";
import { acceptedAnswerEmail } from "@/lib/email/templates";
import { actionError, actionSuccess } from "@/lib/errors";
import { env } from "@/lib/env";
import { captureException } from "@/lib/monitoring";
import { isNotificationMuted } from "@/lib/notification-mutes";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { getActiveSession } from "@/lib/session";
import { acceptedAnswerSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to choose a best answer."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `accepted-answer:${session.user.id}`,
    30,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = acceptedAnswerSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a valid answer."),
      { status: 400 },
    );

  const { id } = await params;
  const question = await prisma.question.findFirst({
    where: { id, deletedAt: null, mergedIntoId: null },
    select: {
      id: true,
      slug: true,
      title: true,
      authorId: true,
      acceptedAnswerId: true,
      topics: {
        select: { topicId: true, topic: { select: { name: true } } },
      },
    },
  });
  if (!question)
    return NextResponse.json(actionError("NOT_FOUND", "Question not found."), {
      status: 404,
    });
  if (question.authorId !== session.user.id)
    return NextResponse.json(
      actionError("FORBIDDEN", "Only the question author can choose this."),
      { status: 403 },
    );

  const answer = parsed.data.answerId
    ? await prisma.answer.findFirst({
        where: {
          id: parsed.data.answerId,
          questionId: question.id,
          deletedAt: null,
          isHidden: false,
        },
        select: {
          id: true,
          authorId: true,
          author: {
            select: {
              id: true,
              email: true,
              name: true,
              preference: { select: { emailAcceptedAnswers: true } },
            },
          },
        },
      })
    : null;
  if (parsed.data.answerId && !answer)
    return NextResponse.json(
      actionError("NOT_FOUND", "That answer is no longer available."),
      { status: 404 },
    );

  const result = await prisma.$transaction(async (tx) => {
    let notificationMuted = false;
    if (question.acceptedAnswerId && question.acceptedAnswerId !== answer?.id) {
      const previous = await tx.answer.findUnique({
        where: { id: question.acceptedAnswerId },
        select: { authorId: true },
      });
      if (previous && previous.authorId !== session.user.id) {
        const previousAuthor = await tx.user.findUnique({
          where: { id: previous.authorId },
          select: { reputation: true },
        });
        await tx.user.update({
          where: { id: previous.authorId },
          data: {
            reputation: Math.max(0, (previousAuthor?.reputation ?? 0) - 25),
          },
        });
      }
    }
    if (
      answer &&
      question.acceptedAnswerId !== answer.id &&
      answer.authorId !== session.user.id
    ) {
      const updatedAuthor = await tx.user.update({
        where: { id: answer.authorId },
        data: { reputation: { increment: 25 } },
        select: { reputation: true },
      });
      await tx.userBadge.upsert({
        where: {
          userId_type_label: {
            userId: answer.authorId,
            type: "HELPFUL_ANSWER",
            label: "Helpful Answer",
          },
        },
        create: {
          userId: answer.authorId,
          type: "HELPFUL_ANSWER",
          label: "Helpful Answer",
          description: "Wrote an answer that was selected as best.",
        },
        update: {},
      });
      if (updatedAuthor.reputation >= 1000)
        await tx.userBadge.upsert({
          where: {
            userId_type_label: {
              userId: answer.authorId,
              type: "TOP_WRITER",
              label: "Top Writer",
            },
          },
          create: {
            userId: answer.authorId,
            type: "TOP_WRITER",
            label: "Top Writer",
            description:
              "Earned from consistently useful community contributions.",
          },
          update: {},
        });
      const topicName = question.topics[0]?.topic.name;
      if (topicName)
        await tx.userBadge.upsert({
          where: {
            userId_type_label: {
              userId: answer.authorId,
              type: "TOPIC_EXPERT",
              label: `${topicName} Expert`,
            },
          },
          create: {
            userId: answer.authorId,
            type: "TOPIC_EXPERT",
            label: `${topicName} Expert`,
            description: `Had an answer selected as best in ${topicName}.`,
          },
          update: {},
        });
      if (answer.authorId !== session.user.id)
        notificationMuted = await isNotificationMuted(tx, answer.authorId, {
          actorId: session.user.id,
          topicIds: question.topics.map((topic) => topic.topicId),
        });
      if (answer.authorId !== session.user.id && !notificationMuted)
        await tx.notification.create({
          data: {
            recipientId: answer.authorId,
            actorId: session.user.id,
            questionId: question.id,
            answerId: answer.id,
            type: "ACCEPTED_ANSWER",
            message: `${session.user.name ?? "Someone"} marked your answer as best`,
          },
        });
    }
    const updated = await tx.question.update({
      where: { id: question.id },
      data: { acceptedAnswerId: answer?.id ?? null },
      select: { id: true, acceptedAnswerId: true },
    });
    return { ...updated, notificationMuted };
  });

  if (
    answer &&
    question.acceptedAnswerId !== answer.id &&
    answer.authorId !== session.user.id &&
    !result.notificationMuted &&
    answer.author.preference?.emailAcceptedAnswers !== false
  )
    void sendEmail(
      acceptedAnswerEmail({
        to: answer.author.email,
        name: answer.author.name,
        question: question.title,
        url: `${env.APP_URL}/question/${question.slug}#answer-${answer.id}`,
      }),
    ).catch((error) =>
      captureException(error, {
        operation: "email.accepted_answer",
        requestId: request.headers.get("x-request-id") ?? undefined,
        userId: answer.author.id,
      }),
    );

  void trackAnalytics("answer_accepted", {
    userId: session.user.id,
    request,
    properties: {
      questionId: question.id,
      answerId: result.acceptedAnswerId,
      accepted: Boolean(result.acceptedAnswerId),
    },
  });

  return NextResponse.json(
    actionSuccess({
      id: result.id,
      acceptedAnswerId: result.acceptedAnswerId,
    }),
  );
}
