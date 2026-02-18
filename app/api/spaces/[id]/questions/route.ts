import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email/provider";
import { spacePostEmail, spaceReviewEmail } from "@/lib/email/templates";
import { actionError, actionSuccess } from "@/lib/errors";
import { env } from "@/lib/env";
import { captureException } from "@/lib/monitoring";
import {
  filterNotificationRecipients,
  isNotificationMuted,
} from "@/lib/notification-mutes";
import { recordTopicAffinity } from "@/lib/personalization";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { getActiveSession } from "@/lib/session";
import { spaceSubmitSchema } from "@/lib/validators";

const moderateSchema = z.object({
  questionId: z.string().cuid(),
  action: z.enum(["APPROVE", "REJECT"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to submit to a Space."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `space-submit:${session.user.id}`,
    20,
    60 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = spaceSubmitSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a question."),
      { status: 400 },
    );

  const { id } = await params;
  const [space, question, membership] = await Promise.all([
    prisma.space.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        ownerId: true,
        name: true,
        slug: true,
        allowMemberSubmissions: true,
        requireApproval: true,
      },
    }),
    prisma.question.findFirst({
      where: {
        id: parsed.data.questionId,
        deletedAt: null,
        isHidden: false,
        mergedIntoId: null,
        authorId: session.user.id,
      },
      select: {
        id: true,
        slug: true,
        title: true,
        topics: { select: { topicId: true } },
      },
    }),
    prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: id, userId: session.user.id } },
      select: { role: true },
    }),
  ]);
  if (!space || !question)
    return NextResponse.json(
      actionError("NOT_FOUND", "Space or question was not found."),
      { status: 404 },
    );

  const trustedSubmitter = ["OWNER", "MODERATOR", "CONTRIBUTOR"].includes(
    membership?.role ?? "",
  );
  if (!trustedSubmitter && !space.allowMemberSubmissions)
    return NextResponse.json(
      actionError(
        "FORBIDDEN",
        "This Space accepts submissions only from trusted members.",
      ),
      { status: 403 },
    );
  const autoApprove = trustedSubmitter || !space.requireApproval;
  const topicIds = question.topics.map((topic) => topic.topicId);
  const submission = await prisma.$transaction(async (tx) => {
    const existing = await tx.spaceQuestion.findUnique({
      where: {
        spaceId_questionId: {
          spaceId: space.id,
          questionId: question.id,
        },
      },
      select: { status: true },
    });
    if (existing) return { ...existing, emailRecipients: [] };

    const created = await tx.spaceQuestion.create({
      data: {
        spaceId: space.id,
        questionId: question.id,
        submittedById: session.user.id,
        approvedById: autoApprove ? session.user.id : undefined,
        status: autoApprove ? "APPROVED" : "SUBMITTED",
      },
      select: { status: true },
    });
    if (created.status === "APPROVED") {
      await recordTopicAffinity(tx, {
        userId: session.user.id,
        topicIds,
        signal: "space",
      });
      await tx.space.update({
        where: { id: space.id },
        data: { questionCount: { increment: 1 } },
      });
      const members = await tx.spaceMember.findMany({
        where: {
          spaceId: space.id,
          userId: { not: session.user.id },
        },
        select: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              preference: { select: { emailSpacePosts: true } },
            },
          },
        },
        take: 50,
      });
      const notificationRecipients = await filterNotificationRecipients(
        tx,
        members.map((member) => member.user.id),
        { actorId: session.user.id, topicIds },
      );
      const notificationRecipientSet = new Set(notificationRecipients);
      if (notificationRecipients.length)
        await tx.notification.createMany({
          data: notificationRecipients.map((recipientId) => ({
            recipientId,
            actorId: session.user.id,
            questionId: question.id,
            type: "SPACE_POST" as const,
            message: `added a question to ${space.name}`,
          })),
        });
      return {
        ...created,
        emailRecipients: members
          .map((member) => member.user)
          .filter(
            (user) =>
              notificationRecipientSet.has(user.id) &&
              user.preference?.emailSpacePosts !== false,
          ),
      };
    }
    if (!autoApprove) {
      const moderators = await tx.spaceMember.findMany({
        where: { spaceId: space.id, role: { in: ["OWNER", "MODERATOR"] } },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              preference: { select: { emailSpacePosts: true } },
            },
          },
        },
      });
      const moderatorRecipients = moderators.filter(
        (moderator) => moderator.userId !== session.user.id,
      );
      const notificationRecipients = await filterNotificationRecipients(
        tx,
        moderatorRecipients.map((moderator) => moderator.userId),
        { actorId: session.user.id, topicIds },
      );
      const notificationRecipientSet = new Set(notificationRecipients);
      if (notificationRecipients.length)
        await tx.notification.createMany({
          data: notificationRecipients.map((recipientId) => ({
            recipientId,
            actorId: session.user.id,
            questionId: question.id,
            type: "SPACE_POST" as const,
            message: "submitted a question for Space review",
          })),
        });
      return {
        ...created,
        emailRecipients: moderators
          .map((moderator) => moderator.user)
          .filter(
            (user) =>
              user.id !== session.user.id &&
              notificationRecipientSet.has(user.id) &&
              user.preference?.emailSpacePosts !== false,
          ),
      };
    }
    return { ...created, emailRecipients: [] };
  });

  for (const recipient of submission.emailRecipients)
    void sendEmail(
      spacePostEmail({
        to: recipient.email,
        name: recipient.name,
        space: space.name,
        question: question.title,
        url:
          submission.status === "APPROVED"
            ? `${env.APP_URL}/question/${question.slug}`
            : `${env.APP_URL}/spaces/${space.slug}`,
      }),
    ).catch((error) =>
      captureException(error, {
        operation: "email.space_post",
        requestId: request.headers.get("x-request-id") ?? undefined,
        userId: recipient.id,
      }),
    );

  return NextResponse.json(actionSuccess({ status: submission.status }), {
    status: 201,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to moderate a Space."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `space-moderate:${session.user.id}`,
    120,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = moderateSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a pending submission."),
      { status: 400 },
    );

  const { id } = await params;
  const membership = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: id, userId: session.user.id } },
    select: { role: true },
  });
  if (!["OWNER", "MODERATOR"].includes(membership?.role ?? ""))
    return NextResponse.json(
      actionError("FORBIDDEN", "Space moderator access is required."),
      { status: 403 },
    );

  const nextStatus = parsed.data.action === "APPROVE" ? "APPROVED" : "REJECTED";
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.spaceQuestion.findUnique({
        where: {
          spaceId_questionId: {
            spaceId: id,
            questionId: parsed.data.questionId,
          },
        },
        include: {
          question: {
            select: {
              authorId: true,
              author: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  preference: { select: { emailSpacePosts: true } },
                },
              },
              slug: true,
              title: true,
              topics: { select: { topicId: true } },
            },
          },
          space: { select: { name: true, slug: true } },
        },
      });
      if (!existing) throw new Error("NOT_FOUND");

      const updated = await tx.spaceQuestion.update({
        where: {
          spaceId_questionId: {
            spaceId: id,
            questionId: parsed.data.questionId,
          },
        },
        data: {
          status: nextStatus,
          approvedById: nextStatus === "APPROVED" ? session.user.id : null,
        },
        select: { status: true },
      });
      const topicIds = existing.question.topics.map((topic) => topic.topicId);
      if (existing.status !== "APPROVED" && nextStatus === "APPROVED")
        await recordTopicAffinity(tx, {
          userId: existing.question.authorId,
          topicIds,
          signal: "space",
        });
      if (existing.status !== "APPROVED" && nextStatus === "APPROVED")
        await tx.space.update({
          where: { id },
          data: { questionCount: { increment: 1 } },
        });
      if (existing.status === "APPROVED" && nextStatus !== "APPROVED")
        await tx.space.updateMany({
          where: { id, questionCount: { gt: 0 } },
          data: { questionCount: { decrement: 1 } },
        });
      let submitterEmailRecipient: {
        id: string;
        email: string;
        name: string;
        preference: { emailSpacePosts: boolean } | null;
      } | null = null;
      if (existing.question.authorId !== session.user.id) {
        const muted = await isNotificationMuted(
          tx,
          existing.question.authorId,
          {
            actorId: session.user.id,
            topicIds,
          },
        );
        if (!muted)
          await tx.notification.create({
            data: {
              recipientId: existing.question.authorId,
              actorId: session.user.id,
              questionId: parsed.data.questionId,
              type: "SPACE_POST",
              message:
                nextStatus === "APPROVED"
                  ? "approved your question in a Space"
                  : "reviewed your Space submission",
            },
          });
        if (
          !muted &&
          existing.question.author.preference?.emailSpacePosts !== false
        )
          submitterEmailRecipient = existing.question.author;
      }
      const members =
        existing.status !== "APPROVED" && nextStatus === "APPROVED"
          ? await tx.spaceMember.findMany({
              where: {
                spaceId: id,
                userId: {
                  notIn: [session.user.id, existing.question.authorId],
                },
              },
              select: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                    preference: { select: { emailSpacePosts: true } },
                  },
                },
              },
              take: 50,
            })
          : [];
      const notificationRecipients = await filterNotificationRecipients(
        tx,
        members.map((member) => member.user.id),
        { actorId: session.user.id, topicIds },
      );
      const notificationRecipientSet = new Set(notificationRecipients);
      if (notificationRecipients.length)
        await tx.notification.createMany({
          data: notificationRecipients.map((recipientId) => ({
            recipientId,
            actorId: session.user.id,
            questionId: parsed.data.questionId,
            type: "SPACE_POST" as const,
            message: `approved a question in ${existing.space.name}`,
          })),
        });
      return {
        ...updated,
        question: existing.question,
        space: existing.space,
        submitterEmailRecipient,
        emailRecipients: members
          .map((member) => member.user)
          .filter(
            (user) =>
              notificationRecipientSet.has(user.id) &&
              user.preference?.emailSpacePosts !== false,
          ),
      };
    });

    if (result.submitterEmailRecipient)
      void sendEmail(
        spaceReviewEmail({
          to: result.submitterEmailRecipient.email,
          name: result.submitterEmailRecipient.name,
          space: result.space.name,
          question: result.question.title,
          approved: result.status === "APPROVED",
          url:
            result.status === "APPROVED"
              ? `${env.APP_URL}/question/${result.question.slug}`
              : `${env.APP_URL}/spaces/${result.space.slug}`,
        }),
      ).catch((error) =>
        captureException(error, {
          operation: "email.space_review",
          requestId: request.headers.get("x-request-id") ?? undefined,
          userId: result.submitterEmailRecipient?.id,
        }),
      );

    for (const recipient of result.emailRecipients)
      void sendEmail(
        spacePostEmail({
          to: recipient.email,
          name: recipient.name,
          space: result.space.name,
          question: result.question.title,
          url: `${env.APP_URL}/question/${result.question.slug}`,
        }),
      ).catch((error) =>
        captureException(error, {
          operation: "email.space_approval",
          requestId: request.headers.get("x-request-id") ?? undefined,
          userId: recipient.id,
        }),
      );

    return NextResponse.json(actionSuccess({ status: result.status }));
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND")
      return NextResponse.json(
        actionError("NOT_FOUND", "That submission was not found."),
        { status: 404 },
      );
    return NextResponse.json(
      actionError("INTERNAL_ERROR", "Submission could not be updated."),
      { status: 500 },
    );
  }
}
