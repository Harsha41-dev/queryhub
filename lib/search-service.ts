import "server-only";

import { prisma } from "@/lib/prisma";
import type { FeedQuestion, PersonSummary, TopicSummary } from "@/lib/types";

export type SearchOptions = {
  query: string;
  page?: number;
  pageSize?: number;
  sort?: "relevance" | "newest";
};

// simple search across questions, answers, topics, and people
export async function searchAll({
  query,
  page = 1,
  pageSize = 12,
  sort = "relevance",
}: SearchOptions) {
  const skip = (page - 1) * pageSize;

  const questionWhere = {
    deletedAt: null,
    isHidden: false,
    author: {
      suspendedAt: null,
      deletedAt: null,
      preference: { is: { profilePublic: true } },
    },
    OR: [
      { title: { contains: query, mode: "insensitive" as const } },
      { description: { contains: query, mode: "insensitive" as const } },
    ],
  };

  const answerWhere = {
    deletedAt: null,
    isHidden: false,
    author: {
      suspendedAt: null,
      deletedAt: null,
      preference: { is: { profilePublic: true } },
    },
    OR: [{ content: { contains: query, mode: "insensitive" as const } }],
    question: { deletedAt: null, isHidden: false },
  };

  const topicWhere = {
    deletedAt: null,
    OR: [
      { name: { contains: query, mode: "insensitive" as const } },
      { description: { contains: query, mode: "insensitive" as const } },
    ],
  };

  const userWhere = {
    deletedAt: null,
    suspendedAt: null,
    preference: { is: { profilePublic: true } },
    OR: [
      { name: { contains: query, mode: "insensitive" as const } },
      { username: { contains: query, mode: "insensitive" as const } },
      { bio: { contains: query, mode: "insensitive" as const } },
      { occupation: { contains: query, mode: "insensitive" as const } },
    ],
  };

  const [
    questions,
    answers,
    topics,
    people,
    questionCount,
    answerCount,
    topicCount,
    userCount,
  ] = await prisma.$transaction([
    prisma.question.findMany({
      where: questionWhere,
      include: {
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
        topics: { include: { topic: true } },
      },
      orderBy:
        sort === "newest"
          ? [{ createdAt: "desc" }]
          : [{ score: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.answer.findMany({
      where: answerWhere,
      include: {
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
        question: { select: { title: true, slug: true } },
      },
      orderBy:
        sort === "newest"
          ? [{ createdAt: "desc" }]
          : [{ score: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.topic.findMany({
      where: topicWhere,
      orderBy:
        sort === "newest"
          ? [{ createdAt: "desc" }]
          : [{ followerCount: "desc" }, { name: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.user.findMany({
      where: userWhere,
      include: { _count: { select: { followers: true, answers: true } } },
      orderBy:
        sort === "newest"
          ? [{ createdAt: "desc" }]
          : [{ reputation: "desc" }, { createdAt: "desc" }],
      skip,
      take: pageSize,
    }),
    prisma.question.count({ where: questionWhere }),
    prisma.answer.count({ where: answerWhere }),
    prisma.topic.count({ where: topicWhere }),
    prisma.user.count({ where: userWhere }),
  ]);

  return {
    questions: questions.map(
      (item): FeedQuestion => ({
        id: item.id,
        slug: item.slug,
        title: item.title,
        topics: item.topics.map((topic) => topic.topic.name),
        author: {
          id: item.author.id,
          name: item.author.name,
          username: item.author.username,
          avatar: item.author.image ?? "https://i.pravatar.cc/160?img=11",
          headline:
            item.author.occupation ?? item.author.bio ?? "QueryHub contributor",
          verified:
            item.author.role === "ADMIN" || item.author.role === "MODERATOR",
        },
        answer: item.description ?? "",
        publishedAt: item.createdAt.toISOString(),
        score: item.score,
        comments: 0,
        views: item.viewCount,
        answers: item.answerCount,
      }),
    ),
    answers: answers.map((item) => ({
      id: item.id,
      content: item.content,
      questionTitle: item.question.title,
      questionSlug: item.question.slug,
      author: {
        id: item.author.id,
        name: item.author.name,
        username: item.author.username,
        avatar: item.author.image ?? "https://i.pravatar.cc/160?img=11",
        headline:
          item.author.occupation ?? item.author.bio ?? "QueryHub contributor",
        verified:
          item.author.role === "ADMIN" || item.author.role === "MODERATOR",
      },
      score: item.score,
      createdAt: item.createdAt.toISOString(),
    })),
    topics: topics.map(
      (item, index): TopicSummary => ({
        id: item.id,
        slug: item.slug,
        name: item.name,
        description: item.description,
        followers: item.followerCount,
        questions: item.questionCount,
        accent:
          item.color ?? ["#4f46e5", "#0891b2", "#16a34a", "#c2410c"][index % 4],
        icon: item.name
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      }),
    ),
    people: people.map(
      (item): PersonSummary => ({
        id: item.id,
        name: item.name,
        username: item.username,
        avatar: item.image ?? "https://i.pravatar.cc/160?img=11",
        headline: item.occupation ?? item.bio ?? "QueryHub contributor",
        verified: item.role === "ADMIN" || item.role === "MODERATOR",
        followers: item._count.followers,
        answers: item._count.answers,
        expertise: [],
      }),
    ),
    counts: {
      questions: questionCount,
      answers: answerCount,
      topics: topicCount,
      people: userCount,
      total: questionCount + answerCount + topicCount + userCount,
    },
    page,
    pageSize,
    sort,
  };
}

export async function searchQuestions({
  query,
  page = 1,
  pageSize = 20,
}: SearchOptions) {
  const where = {
    deletedAt: null,
    isHidden: false,
    author: {
      suspendedAt: null,
      deletedAt: null,
      preference: { is: { profilePublic: true } },
    },
    OR: [
      { title: { contains: query, mode: "insensitive" as const } },
      { description: { contains: query, mode: "insensitive" as const } },
    ],
  };

  const [items, count] = await prisma.$transaction([
    prisma.question.findMany({
      where,
      include: {
        author: { select: { name: true, username: true, image: true } },
        topics: { include: { topic: true } },
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.question.count({ where }),
  ]);

  return { items, count, page, pageSize };
}
