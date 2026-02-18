import { NextResponse } from "next/server";
import type { Prisma, Role } from "@prisma/client";
import type { z } from "zod";
import { assessUserText, recentDuplicateWindow } from "@/lib/abuse";
import { getActiveSession } from "@/lib/session";
import { sendEmail } from "@/lib/email/provider";
import { commentNotificationEmail } from "@/lib/email/templates";
import { actionError, actionSuccess } from "@/lib/errors";
import { env } from "@/lib/env";
import { extractMentionedUsernames } from "@/lib/mentions";
import { captureException } from "@/lib/monitoring";
import {
  filterNotificationRecipients,
  isNotificationMuted,
} from "@/lib/notification-mutes";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import type { FeedAuthor } from "@/lib/types";
import { commentSchema } from "@/lib/validators";

type CommentInput = z.infer<typeof commentSchema>;
type CommentAnswer = NonNullable<
  Awaited<ReturnType<typeof findAnswerForComment>>
>;
type ParentComment = NonNullable<Awaited<ReturnType<typeof findParentComment>>>;
type ActiveUser = {
  id: string;
  name?: string | null;
};
type EmailRecipient = {
  id: string;
  email: string;
  name: string;
  preference: { emailComments: boolean } | null;
};

function commentAuthorFrom(user: {
  id: string;
  name: string;
  username: string;
  image?: string | null;
  role: Role;
  occupation?: string | null;
  bio?: string | null;
}): FeedAuthor {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatar: user.image ?? "https://i.pravatar.cc/160?img=11",
    headline: user.occupation ?? user.bio ?? "QueryHub contributor",
    verified: user.role === "ADMIN" || user.role === "MODERATOR",
  };
}

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
  const input = parsed.data;

  const abuse = assessUserText(input.content, { maxLinks: 4 });
  if (!abuse.ok)
    return NextResponse.json(actionError(abuse.code, abuse.message), {
      status: 400,
    });

  const answer = await findAnswerForComment(input.answerId);
  if (!answer)
    return NextResponse.json(
      actionError("NOT_FOUND", "That answer is no longer available."),
      { status: 404 },
    );

  const parent = await findParentComment(input.parentId);
  const parentError = validateParentComment(input, parent);
  if (parentError) return parentError;

  const duplicate = await hasRecentDuplicateComment(input, session.user.id);
  if (duplicate)
    return NextResponse.json(
      actionError(
        "DUPLICATE_CONTENT",
        "You recently posted this exact comment.",
      ),
      { status: 409 },
    );

  const comment = await createCommentWithNotifications({
    input,
    answer,
    parent,
    actor: session.user,
  });

  sendDirectCommentEmail({
    request,
    answer,
    parent,
    comment,
    actor: session.user,
  });

  return NextResponse.json(
    actionSuccess({
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt,
      author: commentAuthorFrom(comment.author),
    }),
    { status: 201 },
  );
}

function findAnswerForComment(answerId: string) {
  return prisma.answer.findFirst({
    where: {
      id: answerId,
      deletedAt: null,
      isHidden: false,
      question: { deletedAt: null, isHidden: false, mergedIntoId: null },
    },
    select: {
      id: true,
      authorId: true,
      questionId: true,
      author: {
        select: {
          id: true,
          email: true,
          name: true,
          preference: { select: { emailComments: true } },
        },
      },
      question: {
        select: {
          slug: true,
          title: true,
          topics: { select: { topicId: true } },
        },
      },
    },
  });
}

function findParentComment(parentId?: string) {
  if (!parentId) return null;
  return prisma.comment.findFirst({
    where: { id: parentId, deletedAt: null, isHidden: false },
    select: {
      depth: true,
      answerId: true,
      authorId: true,
      author: {
        select: {
          id: true,
          email: true,
          name: true,
          preference: { select: { emailComments: true } },
        },
      },
    },
  });
}

function validateParentComment(
  input: CommentInput,
  parent: ParentComment | null,
) {
  if (input.parentId && !parent)
    return NextResponse.json(
      actionError("NOT_FOUND", "Parent comment not found."),
      { status: 404 },
    );

  if (parent && (parent.answerId !== input.answerId || parent.depth >= 3))
    return NextResponse.json(
      actionError("DEPTH_LIMIT", "Replies can be nested up to three levels."),
      { status: 400 },
    );

  return null;
}

async function hasRecentDuplicateComment(
  input: CommentInput,
  authorId: string,
) {
  const recentDuplicate = await prisma.comment.findFirst({
    where: {
      answerId: input.answerId,
      authorId,
      content: input.content,
      deletedAt: null,
      createdAt: { gte: recentDuplicateWindow(1) },
    },
    select: { id: true },
  });
  return Boolean(recentDuplicate);
}

async function createCommentWithNotifications({
  input,
  answer,
  parent,
  actor,
}: {
  input: CommentInput;
  answer: CommentAnswer;
  parent: ParentComment | null;
  actor: ActiveUser;
}) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.comment.create({
      data: {
        answerId: input.answerId,
        authorId: actor.id,
        parentId: input.parentId,
        content: input.content,
        depth: parent ? parent.depth + 1 : 0,
      },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: {
          select: {
            id: true,
            name: true,
            username: true,
            image: true,
            role: true,
            occupation: true,
            bio: true,
          },
        },
      },
    });

    await tx.answer.update({
      where: { id: input.answerId },
      data: { commentCount: { increment: 1 } },
    });

    const topicIds = answer.question.topics.map((topic) => topic.topicId);
    const directRecipientId = parent?.authorId ?? answer.authorId;
    const directNotificationMuted = await createDirectCommentNotification(tx, {
      actor,
      answer,
      parent,
      commentId: created.id,
      recipientId: directRecipientId,
      topicIds,
    });

    await createMentionNotifications(tx, {
      input,
      actor,
      answer,
      commentId: created.id,
      directRecipientId,
      topicIds,
    });

    return { ...created, directNotificationMuted };
  });
}

async function createDirectCommentNotification(
  tx: Prisma.TransactionClient,
  {
    actor,
    answer,
    parent,
    commentId,
    recipientId,
    topicIds,
  }: {
    actor: ActiveUser;
    answer: CommentAnswer;
    parent: ParentComment | null;
    commentId: string;
    recipientId: string;
    topicIds: string[];
  },
) {
  if (recipientId === actor.id) return false;

  const muted = await isNotificationMuted(tx, recipientId, {
    actorId: actor.id,
    topicIds,
  });
  if (muted) return true;

  await tx.notification.create({
    data: {
      recipientId,
      actorId: actor.id,
      questionId: answer.questionId,
      answerId: answer.id,
      commentId,
      type: parent ? "REPLY" : "COMMENT",
      message: parent
        ? `${actor.name ?? "Someone"} replied to your comment`
        : `${actor.name ?? "Someone"} commented on your answer`,
    },
  });

  return false;
}

async function createMentionNotifications(
  tx: Prisma.TransactionClient,
  {
    input,
    actor,
    answer,
    commentId,
    directRecipientId,
    topicIds,
  }: {
    input: CommentInput;
    actor: ActiveUser;
    answer: CommentAnswer;
    commentId: string;
    directRecipientId: string;
    topicIds: string[];
  },
) {
  const mentionedUsernames = extractMentionedUsernames(input.content);
  if (mentionedUsernames.length === 0) return;

  const mentionedUsers = await tx.user.findMany({
    where: {
      username: { in: mentionedUsernames },
      id: { notIn: [actor.id, directRecipientId] },
      deletedAt: null,
      suspendedAt: null,
    },
    select: { id: true },
    take: 10,
  });
  const mentionRecipients = await filterNotificationRecipients(
    tx,
    mentionedUsers.map((user) => user.id),
    { actorId: actor.id, topicIds },
  );

  if (mentionRecipients.length === 0) return;

  await tx.notification.createMany({
    data: mentionRecipients.map((recipientId) => ({
      recipientId,
      actorId: actor.id,
      questionId: answer.questionId,
      answerId: answer.id,
      commentId,
      type: "MENTION" as const,
      message: `${actor.name ?? "Someone"} mentioned you in a comment`,
    })),
  });
}

function sendDirectCommentEmail({
  request,
  answer,
  parent,
  comment,
  actor,
}: {
  request: Request;
  answer: CommentAnswer;
  parent: ParentComment | null;
  comment: { directNotificationMuted: boolean };
  actor: ActiveUser;
}) {
  const recipient: EmailRecipient = parent?.author ?? answer.author;
  if (
    recipient.id === actor.id ||
    comment.directNotificationMuted ||
    recipient.preference?.emailComments === false
  )
    return;

  void sendEmail(
    commentNotificationEmail({
      to: recipient.email,
      name: recipient.name,
      actor: actor.name ?? "Someone",
      question: answer.question.title,
      reply: Boolean(parent),
      url: `${env.APP_URL}/question/${answer.question.slug}#answer-${answer.id}`,
    }),
  ).catch((error) =>
    captureException(error, {
      operation: "email.comment",
      requestId: request.headers.get("x-request-id") ?? undefined,
      userId: recipient.id,
    }),
  );
}
