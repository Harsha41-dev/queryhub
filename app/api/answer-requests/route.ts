import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { sendEmail } from "@/lib/email/provider";
import { answerRequestEmail } from "@/lib/email/templates";
import { actionError, actionSuccess } from "@/lib/errors";
import { env } from "@/lib/env";
import { captureException } from "@/lib/monitoring";
import { isNotificationMuted } from "@/lib/notification-mutes";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { getActiveSession } from "@/lib/session";
import {
  answerRequestSchema,
  answerRequestUpdateSchema,
} from "@/lib/validators";

export async function GET(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to request answers."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `answer-request-suggest:${session.user.id}`,
    60,
    60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const url = new URL(request.url);
  const questionId = url.searchParams.get("questionId") ?? "";
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!questionId)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a question."),
      { status: 400 },
    );
  if (query.length > 0 && query.length < 2)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Enter at least two characters."),
      { status: 400 },
    );

  const question = await prisma.question.findFirst({
    where: {
      id: questionId,
      deletedAt: null,
      isHidden: false,
      mergedIntoId: null,
    },
    select: {
      id: true,
      authorId: true,
      topics: { select: { topicId: true } },
      answers: { where: { deletedAt: null }, select: { authorId: true } },
      answerRequests: { select: { requestedUserId: true } },
    },
  });
  if (!question)
    return NextResponse.json(
      actionError("NOT_FOUND", "That question is no longer available."),
      { status: 404 },
    );

  const excluded = new Set([
    session.user.id,
    question.authorId,
    ...question.answers.map((answer) => answer.authorId),
    ...question.answerRequests.map((item) => item.requestedUserId),
  ]);
  const topicIds = question.topics.map((topic) => topic.topicId);
  const discoveryFilter: Prisma.UserWhereInput =
    query.length >= 2
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { username: { contains: query, mode: "insensitive" } },
            { bio: { contains: query, mode: "insensitive" } },
            { occupation: { contains: query, mode: "insensitive" } },
          ],
        }
      : {
          OR: [
            { topicFollows: { some: { topicId: { in: topicIds } } } },
            {
              answers: {
                some: {
                  deletedAt: null,
                  isHidden: false,
                  question: {
                    topics: { some: { topicId: { in: topicIds } } },
                  },
                },
              },
            },
          ],
        };
  const users = await prisma.user.findMany({
    where: {
      id: { notIn: [...excluded] },
      deletedAt: null,
      suspendedAt: null,
      AND: [
        {
          OR: [
            { preference: { is: null } },
            { preference: { is: { profilePublic: true } } },
          ],
        },
        discoveryFilter,
      ],
    },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      occupation: true,
      bio: true,
      reputation: true,
      credentials: {
        where: {
          OR: [{ topicId: { in: topicIds } }, { isDefault: true }],
        },
        take: 4,
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      },
      badges: { take: 2, orderBy: { awardedAt: "desc" } },
      _count: { select: { answers: true, followers: true } },
    },
    orderBy: [{ reputation: "desc" }, { createdAt: "desc" }],
    take: query.length >= 2 ? 12 : 8,
  });

  return NextResponse.json(
    actionSuccess({
      people: users.map((user) => {
        const credential =
          user.credentials.find(
            (item) => item.topicId && topicIds.includes(item.topicId),
          ) ??
          user.credentials.find((item) => item.isDefault) ??
          user.credentials[0];
        return {
          id: user.id,
          name: user.name,
          username: user.username,
          avatar: user.image ?? "https://i.pravatar.cc/160?img=11",
          headline: user.occupation ?? user.bio ?? "QueryHub contributor",
          credential: credential?.label,
          badges: user.badges.map((badge) => badge.label),
          reputation: user.reputation,
          answers: user._count.answers,
          followers: user._count.followers,
        };
      }),
    }),
  );
}

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to request an answer."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `answer-request:${session.user.id}`,
    20,
    60 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = answerRequestSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a valid person to ask."),
      { status: 400 },
    );
  if (parsed.data.userId === session.user.id)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "You cannot request your own answer."),
      { status: 400 },
    );

  try {
    const answerRequest = await prisma.$transaction(async (tx) => {
      const question = await tx.question.findFirst({
        where: {
          id: parsed.data.questionId,
          deletedAt: null,
          isHidden: false,
          answers: { none: { authorId: parsed.data.userId, deletedAt: null } },
        },
        select: {
          id: true,
          slug: true,
          title: true,
          authorId: true,
          topics: { select: { topicId: true } },
        },
      });
      const user = await tx.user.findFirst({
        where: {
          id: parsed.data.userId,
          deletedAt: null,
          suspendedAt: null,
        },
        select: {
          id: true,
          email: true,
          name: true,
          preference: { select: { emailAnswerRequests: true } },
        },
      });
      if (!question || !user) throw new Error("NOT_FOUND");
      if (question.authorId === user.id) throw new Error("QUESTION_AUTHOR");

      const created = await tx.answerRequest.create({
        data: {
          questionId: question.id,
          requesterId: session.user.id,
          requestedUserId: user.id,
          message: parsed.data.message,
        },
        select: { id: true, status: true },
      });
      const notificationMuted = await isNotificationMuted(tx, user.id, {
        actorId: session.user.id,
        topicIds: question.topics.map((topic) => topic.topicId),
      });
      if (!notificationMuted)
        await tx.notification.create({
          data: {
            recipientId: user.id,
            actorId: session.user.id,
            questionId: question.id,
            type: "ANSWER_REQUEST",
            message: `${session.user.name ?? "Someone"} requested your answer`,
          },
        });
      return {
        ...created,
        question,
        recipient: user,
        notificationMuted,
      };
    });
    if (
      !answerRequest.notificationMuted &&
      answerRequest.recipient.preference?.emailAnswerRequests !== false
    )
      void sendEmail(
        answerRequestEmail({
          to: answerRequest.recipient.email,
          name: answerRequest.recipient.name,
          actor: session.user.name ?? "Someone",
          question: answerRequest.question.title,
          url: `${env.APP_URL}/question/${answerRequest.question.slug}`,
        }),
      ).catch((error) =>
        captureException(error, {
          operation: "email.answer_request",
          requestId: request.headers.get("x-request-id") ?? undefined,
          userId: answerRequest.recipient.id,
        }),
      );
    return NextResponse.json(
      actionSuccess({ id: answerRequest.id, status: answerRequest.status }),
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        actionError("ALREADY_REQUESTED", "This person was already requested."),
        { status: 409 },
      );
    if (error instanceof Error && error.message === "NOT_FOUND")
      return NextResponse.json(
        actionError("NOT_FOUND", "That question or person is not available."),
        { status: 404 },
      );
    if (error instanceof Error && error.message === "QUESTION_AUTHOR")
      return NextResponse.json(
        actionError(
          "VALIDATION_ERROR",
          "The question author cannot be requested for this question.",
        ),
        { status: 400 },
      );
    return NextResponse.json(
      actionError("INTERNAL_ERROR", "The answer request could not be sent."),
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to manage answer requests."),
      { status: 401 },
    );

  const parsed = answerRequestUpdateSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose an answer request."),
      { status: 400 },
    );

  const result = await prisma.answerRequest.updateMany({
    where: {
      id: parsed.data.id,
      requestedUserId: session.user.id,
      status: "PENDING",
    },
    data: {
      status: parsed.data.action === "ANSWERED" ? "ANSWERED" : "DISMISSED",
      answeredAt: parsed.data.action === "ANSWERED" ? new Date() : undefined,
    },
  });
  return NextResponse.json(actionSuccess({ updated: result.count }));
}
