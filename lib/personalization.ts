import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FeedQuestion } from "@/lib/types";

type PrismaWriteClient = typeof prisma | Prisma.TransactionClient;

export type AffinitySignal =
  | "view"
  | "question"
  | "answer"
  | "upvote"
  | "downvote"
  | "bookmark"
  | "follow"
  | "space";

const signalWeights: Record<AffinitySignal, number> = {
  view: 1,
  question: 12,
  answer: 10,
  upvote: 5,
  downvote: -6,
  bookmark: 8,
  follow: 14,
  space: 6,
};

const signalCounters: Partial<Record<AffinitySignal, keyof CounterUpdates>> = {
  view: "viewCount",
  answer: "answerCount",
  upvote: "voteCount",
  downvote: "voteCount",
  bookmark: "bookmarkCount",
  follow: "followCount",
};

type CounterUpdates = {
  viewCount: number;
  answerCount: number;
  voteCount: number;
  bookmarkCount: number;
  followCount: number;
};

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MILLISECONDS_PER_HOUR = 36e5;

export async function recordTopicAffinity(
  client: PrismaWriteClient,
  {
    userId,
    topicIds,
    signal,
  }: {
    userId: string;
    topicIds: Array<string | null | undefined>;
    signal: AffinitySignal;
  },
) {
  const uniqueTopicIds = uniqueDefinedIds(topicIds);
  if (!uniqueTopicIds.length) return;

  const now = new Date();

  await Promise.all(
    uniqueTopicIds.map((topicId) => {
      const { increment, createCounters, updateData } = affinityWriteData(
        signal,
        now,
      );

      return client.userTopicAffinity.upsert({
        where: { userId_topicId: { userId, topicId } },
        update: updateData,
        create: {
          userId,
          topicId,
          weight: increment,
          lastInteractedAt: now,
          ...createCounters,
        },
      });
    }),
  );
}

function uniqueDefinedIds(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean))] as string[];
}

function affinityWriteData(signal: AffinitySignal, now: Date) {
  const increment = signalWeights[signal];
  const counter = signalCounters[signal];
  const createCounters: CounterUpdates = {
    viewCount: 0,
    answerCount: 0,
    voteCount: 0,
    bookmarkCount: 0,
    followCount: 0,
  };
  const updateData: Prisma.UserTopicAffinityUpdateInput = {
    weight: { increment },
    lastInteractedAt: now,
  };

  if (counter) {
    createCounters[counter] = 1;
    updateData[counter] = { increment: 1 };
  }

  return { increment, createCounters, updateData };
}

export async function recordQuestionView({
  userId,
  questionId,
  topicIds,
}: {
  userId: string;
  questionId: string;
  topicIds: string[];
}) {
  await prisma.$transaction(async (tx) => {
    await tx.questionView.upsert({
      where: { userId_questionId: { userId, questionId } },
      update: { count: { increment: 1 }, lastViewedAt: new Date() },
      create: { userId, questionId },
    });
    await recordTopicAffinity(tx, { userId, topicIds, signal: "view" });
  });
}

export function scorePersonalizedFeed(
  question: FeedQuestion,
  {
    topicAffinities,
    viewedQuestions,
  }: {
    topicAffinities: Map<string, number>;
    viewedQuestions: Map<string, { count: number; lastViewedAt: Date }>;
  },
) {
  const view = viewedQuestions.get(question.id);

  return (
    question.score * 2 +
    question.answers * 3 +
    Math.log10(question.views + 10) * 4 +
    topicAffinityBoost(question, topicAffinities) +
    (question.topicItems?.some((topic) => topic.followed) ? 30 : 0) +
    (question.author.followed ? 20 : 0) +
    (question.followed ? 25 : 0) +
    (question.acceptedAnswerId ? 10 : 0) -
    recentViewPenalty(view) -
    questionAgeHours(question.createdAt) * 0.18
  );
}

function topicAffinityBoost(
  question: FeedQuestion,
  topicAffinities: Map<string, number>,
) {
  const rawAffinity =
    question.topicItems?.reduce((sum, topic) => {
      if (!topic.id) return sum;
      return sum + (topicAffinities.get(topic.id) ?? 0);
    }, 0) ?? 0;

  return Math.min(60, Math.max(-30, rawAffinity));
}

function recentViewPenalty(view?: { count: number; lastViewedAt: Date }) {
  if (!view) return 0;
  const viewedRecently = Date.now() - view.lastViewedAt.getTime() < ONE_WEEK_MS;
  return viewedRecently ? Math.min(24, 8 + view.count * 4) : 0;
}

function questionAgeHours(createdAt?: string | Date) {
  if (!createdAt) return 24;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return Math.max(1, ageMs / MILLISECONDS_PER_HOUR);
}
