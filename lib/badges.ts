import "server-only";

import type { BadgeType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type BadgeAward = {
  type: BadgeType;
  label: string;
  description: string;
  topicId?: string | null;
};

export async function evaluateUserBadges(
  userId: string,
  { topicIds = [] }: { topicIds?: string[] } = {},
) {
  const [user, answerCount, acceptedCount, helpfulAnswer, topicStats] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, reputation: true },
      }),
      prisma.answer.count({
        where: { authorId: userId, deletedAt: null, isHidden: false },
      }),
      prisma.answer.count({
        where: {
          authorId: userId,
          deletedAt: null,
          isHidden: false,
          acceptedFor: { isNot: null },
        },
      }),
      prisma.answer.findFirst({
        where: {
          authorId: userId,
          deletedAt: null,
          isHidden: false,
          score: { gte: 25 },
        },
        select: { id: true },
      }),
      topicIds.length
        ? prisma.questionTopic.findMany({
            where: {
              topicId: { in: [...new Set(topicIds)] },
              question: {
                answers: {
                  some: {
                    authorId: userId,
                    deletedAt: null,
                    isHidden: false,
                    OR: [
                      { score: { gte: 8 } },
                      { acceptedFor: { isNot: null } },
                    ],
                  },
                },
              },
            },
            select: {
              topic: { select: { id: true, name: true } },
              question: {
                select: {
                  answers: {
                    where: {
                      authorId: userId,
                      deletedAt: null,
                      isHidden: false,
                      OR: [
                        { score: { gte: 8 } },
                        { acceptedFor: { isNot: null } },
                      ],
                    },
                    select: { id: true },
                  },
                },
              },
            },
          })
        : Promise.resolve([]),
    ]);
  if (!user) return;

  const awards: BadgeAward[] = [];
  if (user.role === "MODERATOR" || user.role === "ADMIN")
    awards.push({
      type: "MODERATOR",
      label: user.role === "ADMIN" ? "Admin" : "Moderator",
      description: "Trusted to review reports and protect community quality.",
    });
  if (user.reputation >= 1000)
    awards.push({
      type: "TOP_WRITER",
      label: "Top Writer",
      description: "Earned from consistently useful community contributions.",
    });
  if (answerCount >= 5)
    awards.push({
      type: "VERIFIED_CONTRIBUTOR",
      label: "Verified Contributor",
      description: "Published multiple substantial answers.",
    });
  if (helpfulAnswer)
    awards.push({
      type: "HELPFUL_ANSWER",
      label: "Helpful Answer",
      description: "Wrote an answer that reached a strong positive score.",
    });
  if (acceptedCount >= 3)
    awards.push({
      type: "TOP_WRITER",
      label: "Best Answer Contributor",
      description: "Had several answers selected by question authors.",
    });

  const topicCounts = new Map<string, { name: string; count: number }>();
  for (const stat of topicStats) {
    const current = topicCounts.get(stat.topic.id) ?? {
      name: stat.topic.name,
      count: 0,
    };
    current.count += stat.question.answers.length;
    topicCounts.set(stat.topic.id, current);
  }
  for (const [topicId, stat] of topicCounts) {
    if (stat.count >= 3)
      awards.push({
        type: "TOPIC_EXPERT",
        topicId,
        label: `${stat.name} Expert`,
        description: `Recognized for helpful answers in ${stat.name}.`,
      });
  }

  await Promise.all(
    awards.map((award) =>
      prisma.userBadge.upsert({
        where: {
          userId_type_label: {
            userId,
            type: award.type,
            label: award.label,
          },
        },
        create: { userId, ...award },
        update: {
          description: award.description,
          topicId: award.topicId ?? undefined,
        },
      }),
    ),
  );
}
