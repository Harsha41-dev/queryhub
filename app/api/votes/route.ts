import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getActiveSession } from "@/lib/session";
import { trackAnalytics } from "@/lib/analytics";
import { evaluateUserBadges } from "@/lib/badges";
import { actionError, actionSuccess } from "@/lib/errors";
import { isNotificationMuted } from "@/lib/notification-mutes";
import { recordTopicAffinity } from "@/lib/personalization";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { voteSchema } from "@/lib/validators";

type VoteValue = -1 | 0 | 1;
type VoteTarget = {
  kind: "question" | "answer" | "comment";
  id: string;
};
type VoteTargetDetails = {
  recipientId: string;
  topicIds: string[];
  notificationTarget: {
    questionId?: string;
    answerId?: string;
    commentId?: string;
  };
};
type VoteActor = {
  id: string;
  name?: string | null;
};
type VoteIdField = "questionId" | "answerId" | "commentId";

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

  const { value } = parsed.data;
  const target = targetFromVote(parsed.data);
  const targetDetails = await getVoteTargetDetails(target);
  if (!targetDetails)
    return NextResponse.json(
      actionError("NOT_FOUND", "That item is no longer available."),
      { status: 404 },
    );

  if (targetDetails.recipientId === session.user.id && value !== 0)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "You cannot vote on your own content."),
      { status: 400 },
    );

  try {
    const result = await applyVoteWithRetry({
      actor: session.user,
      target,
      targetDetails,
      value,
    });

    void evaluateUserBadges(targetDetails.recipientId, {
      topicIds: targetDetails.topicIds,
    }).catch(() => undefined);
    void trackAnalytics("vote_cast", {
      userId: session.user.id,
      request,
      properties: {
        targetId: target.id,
        targetKind: target.kind,
        value,
      },
    });

    return NextResponse.json(actionSuccess(result));
  } catch {
    return NextResponse.json(
      actionError("INTERNAL_ERROR", "We could not record your vote."),
      { status: 500 },
    );
  }
}

function targetFromVote(input: {
  questionId?: string;
  answerId?: string;
  commentId?: string;
}): VoteTarget {
  if (input.questionId) return { kind: "question", id: input.questionId };
  if (input.answerId) return { kind: "answer", id: input.answerId };
  return { kind: "comment", id: input.commentId! };
}

async function getVoteTargetDetails(
  target: VoteTarget,
): Promise<VoteTargetDetails | null> {
  if (target.kind === "question") return getQuestionVoteDetails(target.id);
  if (target.kind === "answer") return getAnswerVoteDetails(target.id);
  return getCommentVoteDetails(target.id);
}

async function getQuestionVoteDetails(
  questionId: string,
): Promise<VoteTargetDetails | null> {
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
    },
  });

  if (!question) return null;

  return {
    recipientId: question.authorId,
    notificationTarget: { questionId: question.id },
    topicIds: question.topics.map((topic) => topic.topicId),
  };
}

async function getAnswerVoteDetails(
  answerId: string,
): Promise<VoteTargetDetails | null> {
  const answer = await prisma.answer.findFirst({
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
      question: { select: { topics: { select: { topicId: true } } } },
    },
  });

  if (!answer) return null;

  return {
    recipientId: answer.authorId,
    notificationTarget: {
      answerId: answer.id,
      questionId: answer.questionId,
    },
    topicIds: answer.question.topics.map((topic) => topic.topicId),
  };
}

async function getCommentVoteDetails(
  commentId: string,
): Promise<VoteTargetDetails | null> {
  const comment = await prisma.comment.findFirst({
    where: {
      id: commentId,
      deletedAt: null,
      isHidden: false,
      answer: {
        deletedAt: null,
        isHidden: false,
        question: { deletedAt: null, isHidden: false, mergedIntoId: null },
      },
    },
    select: {
      id: true,
      authorId: true,
      answerId: true,
      answer: {
        select: {
          questionId: true,
          question: { select: { topics: { select: { topicId: true } } } },
        },
      },
    },
  });

  if (!comment) return null;

  return {
    recipientId: comment.authorId,
    notificationTarget: {
      commentId: comment.id,
      answerId: comment.answerId,
      questionId: comment.answer.questionId,
    },
    topicIds: comment.answer.question.topics.map((topic) => topic.topicId),
  };
}

async function applyVoteWithRetry(input: {
  actor: VoteActor;
  target: VoteTarget;
  targetDetails: VoteTargetDetails;
  value: VoteValue;
  attempt?: number;
}): Promise<{ score: number; vote: VoteValue }> {
  try {
    return await applyVote(input);
  } catch (error) {
    if (
      (input.attempt ?? 0) === 0 &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(error.code)
    )
      return applyVoteWithRetry({ ...input, attempt: 1 });
    throw error;
  }
}

async function applyVote({
  actor,
  target,
  targetDetails,
  value,
}: {
  actor: VoteActor;
  target: VoteTarget;
  targetDetails: VoteTargetDetails;
  value: VoteValue;
}) {
  return prisma.$transaction(
    async (tx) => {
      const oldValue = await saveVoteRecord(tx, {
        actorId: actor.id,
        target,
        value,
      });
      const delta = value - oldValue;
      const updated = await updateContentScore(tx, target, delta);

      if (value !== 0)
        await recordTopicAffinity(tx, {
          userId: actor.id,
          topicIds: targetDetails.topicIds,
          signal: value === 1 ? "upvote" : "downvote",
        });

      await updateReputationAndBadges(tx, {
        target,
        recipientId: targetDetails.recipientId,
        actorId: actor.id,
        score: updated.score,
        delta,
      });

      await createUpvoteNotification(tx, {
        actor,
        targetDetails,
        value,
        oldValue,
      });

      return { score: updated.score, vote: value };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

async function saveVoteRecord(
  tx: Prisma.TransactionClient,
  {
    actorId,
    target,
    value,
  }: {
    actorId: string;
    target: VoteTarget;
    value: VoteValue;
  },
) {
  const idField = voteIdField(target);
  const existing = await tx.vote.findFirst({
    where: { userId: actorId, [idField]: target.id },
  });
  const oldValue =
    existing?.value === "UP" ? 1 : existing?.value === "DOWN" ? -1 : 0;

  if (value === 0) {
    if (existing) await tx.vote.delete({ where: { id: existing.id } });
  } else if (existing) {
    await tx.vote.update({
      where: { id: existing.id },
      data: { value: voteValueForDatabase(value) },
    });
  } else {
    await tx.vote.create({
      data: {
        userId: actorId,
        [idField]: target.id,
        value: voteValueForDatabase(value),
      },
    });
  }

  return oldValue;
}

function voteIdField(target: VoteTarget): VoteIdField {
  if (target.kind === "question") return "questionId";
  if (target.kind === "answer") return "answerId";
  return "commentId";
}

function voteValueForDatabase(value: Exclude<VoteValue, 0>) {
  return value === 1 ? "UP" : "DOWN";
}

function updateContentScore(
  tx: Prisma.TransactionClient,
  target: VoteTarget,
  delta: number,
) {
  if (target.kind === "question")
    return tx.question.update({
      where: { id: target.id },
      data: { score: { increment: delta } },
      select: { score: true },
    });

  if (target.kind === "answer")
    return tx.answer.update({
      where: { id: target.id },
      data: { score: { increment: delta } },
      select: { score: true },
    });

  return tx.comment.update({
    where: { id: target.id },
    data: { score: { increment: delta } },
    select: { score: true },
  });
}

async function updateReputationAndBadges(
  tx: Prisma.TransactionClient,
  {
    target,
    recipientId,
    actorId,
    score,
    delta,
  }: {
    target: VoteTarget;
    recipientId: string;
    actorId: string;
    score: number;
    delta: number;
  },
) {
  const reputationDelta =
    target.kind === "answer"
      ? delta * 2
      : target.kind === "question"
        ? delta
        : 0;

  if (reputationDelta !== 0 && recipientId !== actorId) {
    const recipient = await tx.user.findUnique({
      where: { id: recipientId },
      select: { reputation: true },
    });
    const reputation = Math.max(
      0,
      (recipient?.reputation ?? 0) + reputationDelta,
    );
    await tx.user.update({
      where: { id: recipientId },
      data: { reputation },
    });

    if (reputation >= 1000) await awardTopWriterBadge(tx, recipientId);
  }

  if (target.kind === "answer" && score >= 25)
    await awardHelpfulAnswerBadge(tx, recipientId);
}

function awardTopWriterBadge(tx: Prisma.TransactionClient, userId: string) {
  return tx.userBadge.upsert({
    where: {
      userId_type_label: {
        userId,
        type: "TOP_WRITER",
        label: "Top Writer",
      },
    },
    create: {
      userId,
      type: "TOP_WRITER",
      label: "Top Writer",
      description: "Earned from consistently useful community contributions.",
    },
    update: {},
  });
}

function awardHelpfulAnswerBadge(tx: Prisma.TransactionClient, userId: string) {
  return tx.userBadge.upsert({
    where: {
      userId_type_label: {
        userId,
        type: "HELPFUL_ANSWER",
        label: "Helpful Answer",
      },
    },
    create: {
      userId,
      type: "HELPFUL_ANSWER",
      label: "Helpful Answer",
      description: "Wrote an answer that reached a strong positive score.",
    },
    update: {},
  });
}

async function createUpvoteNotification(
  tx: Prisma.TransactionClient,
  {
    actor,
    targetDetails,
    value,
    oldValue,
  }: {
    actor: VoteActor;
    targetDetails: VoteTargetDetails;
    value: VoteValue;
    oldValue: VoteValue;
  },
) {
  if (value !== 1 || oldValue === 1 || targetDetails.recipientId === actor.id)
    return;

  const muted = await isNotificationMuted(tx, targetDetails.recipientId, {
    actorId: actor.id,
    topicIds: targetDetails.topicIds,
  });
  if (muted) return;

  const notified = await tx.notification.findFirst({
    where: {
      recipientId: targetDetails.recipientId,
      actorId: actor.id,
      type: "UPVOTE",
      ...targetDetails.notificationTarget,
    },
    select: { id: true },
  });
  if (notified) return;

  await tx.notification.create({
    data: {
      recipientId: targetDetails.recipientId,
      actorId: actor.id,
      type: "UPVOTE",
      message: `${actor.name ?? "Someone"} upvoted your contribution`,
      ...targetDetails.notificationTarget,
    },
  });
}
