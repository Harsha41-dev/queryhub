import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildSearchExcerpt,
  textRelevance,
  tokenizeSearch,
} from "@/lib/text-intelligence";
import type { TopicSummary } from "@/lib/types";
import { slugify } from "@/lib/utils";

export type SearchOptions = {
  query: string;
  page?: number;
  pageSize?: number;
  sort?: "relevance" | "newest" | "views";
  filter?: "all" | "unanswered";
  topic?: string;
  author?: string;
};

const publicProfileFilter: Prisma.UserWhereInput = {
  OR: [
    { preference: { is: null } },
    { preference: { is: { profilePublic: true } } },
  ],
};

function publicUserWhere(extra?: Prisma.UserWhereInput): Prisma.UserWhereInput {
  return {
    deletedAt: null,
    suspendedAt: null,
    AND: [publicProfileFilter, ...(extra ? [extra] : [])],
  };
}

function topicFacetWhere(value?: string): Prisma.TopicWhereInput | undefined {
  const term = value?.trim();
  if (!term) return undefined;

  const slug = slugify(term);
  return {
    deletedAt: null,
    OR: [
      ...(slug ? [{ slug: { equals: slug } }] : []),
      { name: { contains: term, mode: "insensitive" as const } },
    ],
  };
}

function authorFacetWhere(value?: string): Prisma.UserWhereInput | undefined {
  const term = value?.trim().replace(/^@/, "");
  if (!term) return undefined;

  return {
    OR: [
      { username: { contains: term, mode: "insensitive" as const } },
      { name: { contains: term, mode: "insensitive" as const } },
    ],
  };
}

// Search across questions, answers, topics, and people with lightweight fuzzy ranking.
export async function searchAll({
  query,
  page = 1,
  pageSize = 12,
  sort = "relevance",
  filter = "all",
  topic,
  author,
}: SearchOptions) {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(pageSize, 1), 30);
  const skip = (safePage - 1) * safePageSize;
  const terms = tokenizeSearch(query);
  const phrases = [...new Set([query.trim(), ...terms].filter(Boolean))];
  const candidateTake =
    sort === "relevance"
      ? Math.min(200, Math.max(80, safePage * safePageSize * 4))
      : safePageSize;
  const candidateSkip = sort === "relevance" ? 0 : skip;
  const topicFacet = topicFacetWhere(topic);
  const authorFacet = authorFacetWhere(author);

  const questionTextWhere: Prisma.QuestionWhereInput =
    phrases.length > 0
      ? {
          OR: phrases.flatMap((term) => [
            { title: { contains: term, mode: "insensitive" as const } },
            { description: { contains: term, mode: "insensitive" as const } },
            {
              topics: {
                some: {
                  topic: {
                    name: { contains: term, mode: "insensitive" as const },
                  },
                },
              },
            },
          ]),
        }
      : {};
  const questionWhere: Prisma.QuestionWhereInput = {
    deletedAt: null,
    isHidden: false,
    mergedIntoId: null,
    author: publicUserWhere(authorFacet),
    answerCount: filter === "unanswered" ? 0 : undefined,
    ...(topicFacet ? { topics: { some: { topic: topicFacet } } } : {}),
    ...questionTextWhere,
  };

  const answerTextWhere: Prisma.AnswerWhereInput =
    phrases.length > 0
      ? {
          OR: phrases.flatMap((term) => [
            { content: { contains: term, mode: "insensitive" as const } },
            {
              question: {
                title: { contains: term, mode: "insensitive" as const },
              },
            },
          ]),
        }
      : {};
  const answerWhere: Prisma.AnswerWhereInput = {
    id: filter === "unanswered" ? "__never__" : undefined,
    deletedAt: null,
    isHidden: false,
    author: publicUserWhere(authorFacet),
    ...answerTextWhere,
    question: {
      deletedAt: null,
      isHidden: false,
      mergedIntoId: null,
      author: publicUserWhere(),
      ...(topicFacet ? { topics: { some: { topic: topicFacet } } } : {}),
    },
  };

  const topicWhere: Prisma.TopicWhereInput = {
    deletedAt: null,
    AND: [
      phrases.length > 0
        ? {
            OR: phrases.flatMap((term) => [
              { name: { contains: term, mode: "insensitive" as const } },
              {
                description: {
                  contains: term,
                  mode: "insensitive" as const,
                },
              },
            ]),
          }
        : {},
      ...(topicFacet ? [topicFacet] : []),
    ],
  };

  const userWhere = publicUserWhere({
    AND: [
      phrases.length > 0
        ? {
            OR: phrases.flatMap((term) => [
              { name: { contains: term, mode: "insensitive" as const } },
              { username: { contains: term, mode: "insensitive" as const } },
              { bio: { contains: term, mode: "insensitive" as const } },
              { occupation: { contains: term, mode: "insensitive" as const } },
              {
                credentials: {
                  some: {
                    label: { contains: term, mode: "insensitive" as const },
                  },
                },
              },
            ]),
          }
        : {},
      ...(authorFacet ? [authorFacet] : []),
    ],
  });

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
            reputation: true,
            credentials: { where: { isDefault: true }, take: 1 },
            badges: { take: 2, orderBy: { awardedAt: "desc" } },
          },
        },
        topics: { include: { topic: true } },
      },
      orderBy:
        sort === "views"
          ? [{ viewCount: "desc" }, { score: "desc" }]
          : sort === "newest"
            ? [{ createdAt: "desc" }]
            : [{ score: "desc" }, { createdAt: "desc" }],
      skip: candidateSkip,
      take: candidateTake,
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
            reputation: true,
            credentials: { where: { isDefault: true }, take: 1 },
            badges: { take: 2, orderBy: { awardedAt: "desc" } },
          },
        },
        question: {
          select: { title: true, slug: true, viewCount: true, topics: true },
        },
      },
      orderBy:
        sort === "views"
          ? [{ question: { viewCount: "desc" } }, { score: "desc" }]
          : sort === "newest"
            ? [{ createdAt: "desc" }]
            : [{ score: "desc" }, { createdAt: "desc" }],
      skip: candidateSkip,
      take: candidateTake,
    }),
    prisma.topic.findMany({
      where: topicWhere,
      orderBy:
        sort === "views"
          ? [{ questionCount: "desc" }, { followerCount: "desc" }]
          : sort === "newest"
            ? [{ createdAt: "desc" }]
            : [{ followerCount: "desc" }, { name: "asc" }],
      skip: candidateSkip,
      take: candidateTake,
    }),
    prisma.user.findMany({
      where: userWhere,
      include: {
        credentials: {
          include: { topic: { select: { name: true } } },
          orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
          take: 3,
        },
        badges: { take: 3, orderBy: { awardedAt: "desc" } },
        _count: { select: { followers: true, answers: true } },
      },
      orderBy:
        sort === "newest"
          ? [{ createdAt: "desc" }]
          : [{ reputation: "desc" }, { createdAt: "desc" }],
      skip: candidateSkip,
      take: candidateTake,
    }),
    prisma.question.count({ where: questionWhere }),
    prisma.answer.count({ where: answerWhere }),
    prisma.topic.count({ where: topicWhere }),
    prisma.user.count({ where: userWhere }),
  ]);

  const questionResults = rankResults(
    questions.map((item) => {
      const relevance = textRelevance(query, [
        { text: item.title, weight: 4 },
        { text: item.description, weight: 1.5 },
        {
          text: item.topics.map((topic) => topic.topic.name).join(" "),
          weight: 2,
        },
        { text: item.author.name, weight: 0.5 },
      ]);
      return {
        rank:
          relevance.score +
          item.score * 0.35 +
          Math.log10(item.viewCount + 10) * 3 +
          item.answerCount * 1.2 +
          recencyBoost(item.createdAt),
        item: {
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
              item.author.credentials[0]?.label ??
              item.author.occupation ??
              item.author.bio ??
              "QueryHub contributor",
            credential: item.author.credentials[0]?.label,
            badges: item.author.badges.map((badge) => badge.label),
            verified:
              item.author.role === "ADMIN" || item.author.role === "MODERATOR",
          },
          answer: buildSearchExcerpt(item.description, query),
          publishedAt: item.createdAt.toISOString(),
          score: item.score,
          comments: 0,
          views: item.viewCount,
          answers: item.answerCount,
          matchReason: relevance.reason,
          matchedTerms: relevance.matchedTerms,
        },
      };
    }),
    { sort, skip, take: safePageSize },
  );

  return {
    questions: questionResults,
    answers: rankResults(
      answers.map((item) => {
        const relevance = textRelevance(query, [
          { text: item.content, weight: 3 },
          { text: item.question.title, weight: 2 },
          { text: item.author.name, weight: 0.5 },
          {
            text: item.question.topics.map((topic) => topic.topicId).join(" "),
            weight: 0.5,
          },
        ]);
        return {
          rank:
            relevance.score +
            item.score * 0.45 +
            Math.log10(item.question.viewCount + 10) * 2 +
            recencyBoost(item.createdAt),
          item: {
            id: item.id,
            content: buildSearchExcerpt(item.content, query, 260),
            questionTitle: item.question.title,
            questionSlug: item.question.slug,
            author: {
              id: item.author.id,
              name: item.author.name,
              username: item.author.username,
              avatar: item.author.image ?? "https://i.pravatar.cc/160?img=11",
              headline:
                item.author.credentials[0]?.label ??
                item.author.occupation ??
                item.author.bio ??
                "QueryHub contributor",
              credential: item.author.credentials[0]?.label,
              badges: item.author.badges.map((badge) => badge.label),
              verified:
                item.author.role === "ADMIN" ||
                item.author.role === "MODERATOR",
            },
            score: item.score,
            createdAt: item.createdAt.toISOString(),
            matchReason: relevance.reason,
            matchedTerms: relevance.matchedTerms,
          },
        };
      }),
      { sort, skip, take: safePageSize },
    ),
    topics: rankResults(
      topics.map((item, index) => {
        const relevance = textRelevance(query, [
          { text: item.name, weight: 4 },
          { text: item.description, weight: 1.5 },
        ]);
        return {
          rank:
            relevance.score +
            Math.log10(item.followerCount + 10) * 5 +
            item.questionCount * 0.35,
          item: {
            id: item.id,
            slug: item.slug,
            name: item.name,
            description: buildSearchExcerpt(item.description, query),
            followers: item.followerCount,
            questions: item.questionCount,
            accent:
              item.color ??
              ["#4f46e5", "#0891b2", "#16a34a", "#c2410c"][index % 4],
            icon: item.name
              .split(/\s+/)
              .map((part) => part[0])
              .join("")
              .slice(0, 2)
              .toUpperCase(),
          } satisfies TopicSummary,
        };
      }),
      { sort, skip, take: safePageSize },
    ),
    people: rankResults(
      people.map((item) => {
        const expertise = item.credentials
          .map((credential) => credential.topic?.name ?? credential.label)
          .slice(0, 3);
        const relevance = textRelevance(query, [
          { text: item.name, weight: 4 },
          { text: item.username, weight: 3 },
          { text: item.occupation, weight: 1.5 },
          { text: item.bio, weight: 1 },
          {
            text: item.credentials
              .map((credential) => credential.label)
              .join(" "),
            weight: 2,
          },
        ]);
        return {
          rank:
            relevance.score +
            item.reputation * 0.04 +
            item._count.followers * 0.5 +
            item._count.answers * 0.75,
          item: {
            id: item.id,
            name: item.name,
            username: item.username,
            avatar: item.image ?? "https://i.pravatar.cc/160?img=11",
            headline:
              item.credentials[0]?.label ??
              item.occupation ??
              item.bio ??
              "QueryHub contributor",
            credential: item.credentials[0]?.label,
            badges: item.badges.map((badge) => badge.label),
            verified: item.role === "ADMIN" || item.role === "MODERATOR",
            followers: item._count.followers,
            answers: item._count.answers,
            expertise,
            reputation: item.reputation,
          },
        };
      }),
      { sort, skip, take: safePageSize },
    ),
    counts: {
      questions: questionCount,
      answers: answerCount,
      topics: topicCount,
      people: userCount,
      total: questionCount + answerCount + topicCount + userCount,
    },
    page: safePage,
    pageSize: safePageSize,
    sort,
    filter,
    topic: topic?.trim() || undefined,
    author: author?.trim() || undefined,
  };
}

function rankResults<T>(
  entries: Array<{ item: T; rank: number }>,
  {
    sort,
    skip,
    take,
  }: { sort: SearchOptions["sort"]; skip: number; take: number },
) {
  if (sort !== "relevance") return entries.map((entry) => entry.item);
  return entries
    .filter((entry) => entry.rank > 0)
    .sort((a, b) => b.rank - a.rank)
    .slice(skip, skip + take)
    .map((entry) => entry.item);
}

function recencyBoost(createdAt: Date) {
  const ageHours = Math.max(1, (Date.now() - createdAt.getTime()) / 36e5);
  return Math.max(0, 12 - ageHours * 0.1);
}

export async function searchQuestions({
  query,
  page = 1,
  pageSize = 20,
}: SearchOptions) {
  const where: Prisma.QuestionWhereInput = {
    deletedAt: null,
    isHidden: false,
    mergedIntoId: null,
    author: publicUserWhere(),
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
