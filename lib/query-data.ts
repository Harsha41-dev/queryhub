import "server-only";

import type { NotificationType, Prisma, Role, VoteValue } from "@prisma/client";
import { canModerate } from "@/lib/authorization";
import {
  recordQuestionView,
  scorePersonalizedFeed,
} from "@/lib/personalization";
import { prisma } from "@/lib/prisma";
import type {
  AdminRow,
  AdminRowsPage,
  AnswerRequestItem,
  AnswerRequestQueueItem,
  AnswerSummary,
  BookmarkCollectionSummary,
  CredentialSummary,
  CommentSummary,
  FeedAuthor,
  FeedQuestion,
  NotificationItem,
  PersonSummary,
  QuestionDetailData,
  SpaceInviteSummary,
  SpaceSummary,
  SpaceViewData,
  TopicSummary,
} from "@/lib/types";

// helpers that load feed / profile / admin data and shape it for the UI

const PAGE_SIZE = 20;

function avatarFor(seed: string | null | undefined) {
  if (!seed) return "https://i.pravatar.cc/160?img=11";
  return seed;
}

function colorFor(index: number) {
  const colors = [
    "#4f46e5",
    "#0891b2",
    "#16a34a",
    "#c2410c",
    "#be123c",
    "#7c3aed",
  ];
  return colors[index % colors.length];
}

function iconFor(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function topicSummaryFrom(
  topic: {
    id: string;
    slug: string;
    name: string;
    description: string;
    followerCount: number;
    questionCount: number;
    color?: string | null;
    followers?: unknown[];
  },
  index = 0,
): TopicSummary {
  return {
    id: topic.id,
    slug: topic.slug,
    name: topic.name,
    description: topic.description,
    followers: topic.followerCount,
    questions: topic.questionCount,
    accent: topic.color ?? colorFor(index),
    icon: iconFor(topic.name),
    followed: Boolean(topic.followers?.length),
  };
}

function voteValue(votes: { value: VoteValue }[] | undefined): -1 | 0 | 1 {
  const value = votes?.[0]?.value;
  if (value === "UP") return 1;
  if (value === "DOWN") return -1;
  return 0;
}

function authorFrom(user: {
  id?: string;
  name: string;
  username: string;
  image?: string | null;
  role?: Role;
  occupation?: string | null;
  bio?: string | null;
  reputation?: number | null;
  credentials?: Array<{ label: string; isDefault?: boolean }>;
  badges?: Array<{ label: string }>;
  followers?: unknown[];
}): FeedAuthor {
  const badges = new Set(user.badges?.map((badge) => badge.label) ?? []);
  if (user.role === "ADMIN") badges.add("Admin");
  else if (user.role === "MODERATOR") badges.add("Moderator");
  else if ((user.reputation ?? 0) >= 1000) badges.add("Top Writer");
  const credential =
    user.credentials?.find((item) => item.isDefault)?.label ??
    user.credentials?.[0]?.label;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatar: avatarFor(user.image),
    headline:
      credential || user.occupation || user.bio || "QueryHub contributor",
    credential,
    badges: [...badges].slice(0, 3),
    followed: Boolean(user.followers?.length),
    verified: user.role === "ADMIN" || user.role === "MODERATOR",
  };
}

type FeedRecord = Awaited<ReturnType<typeof getFeedRecords>>[number];

function mapFeedQuestion(record: FeedRecord): FeedQuestion {
  const topAnswer = record.answers[0];
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description ?? "",
    topics: record.topics.map((item) => item.topic.name),
    topicItems: record.topics.map((item, index) =>
      topicSummaryFrom(item.topic, index),
    ),
    author: authorFrom(record.author),
    authorId: record.authorId,
    answer:
      topAnswer?.content ??
      record.description ??
      "No answer has been added yet.",
    publishedAt: record.createdAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    score: record.score,
    comments: topAnswer?.commentCount ?? 0,
    views: record.viewCount,
    answers: record.answerCount,
    acceptedAnswerId: record.acceptedAnswerId,
    userVote: voteValue(record.votes),
    bookmarked: record.bookmarks.length > 0,
    followed: record.followers.length > 0,
    followerCount: record._count.followers,
    spaces: record.spaceLinks.map((link) => link.space),
  };
}

async function getFeedRecords({
  viewerId,
  take = PAGE_SIZE,
  skip = 0,
  where = {},
  orderBy = [{ score: "desc" as const }, { createdAt: "desc" as const }],
}: {
  viewerId?: string;
  take?: number;
  skip?: number;
  where?: Prisma.QuestionWhereInput;
  orderBy?: Prisma.QuestionOrderByWithRelationInput[];
}) {
  const boundedTake = Math.min(Math.max(take, 1), 50);
  const boundedSkip = Math.max(skip, 0);
  const visibility: Prisma.QuestionWhereInput[] = [
    {
      author: {
        deletedAt: null,
        suspendedAt: null,
        OR: [
          ...(viewerId ? [{ id: viewerId }] : []),
          { preference: { is: null } },
          { preference: { is: { profilePublic: true } } },
        ],
      },
    },
  ];
  if (viewerId) {
    visibility.push(
      {
        feedFeedback: {
          none: { userId: viewerId, type: "HIDE_QUESTION" },
        },
      },
      {
        author: {
          mutedByFeedback: {
            none: { userId: viewerId, type: "MUTE_USER" },
          },
        },
      },
      {
        topics: {
          none: {
            topic: {
              feedFeedback: {
                some: { userId: viewerId, type: "NOT_INTERESTED_TOPIC" },
              },
            },
          },
        },
      },
    );
  }
  return prisma.question.findMany({
    where: {
      deletedAt: null,
      isHidden: false,
      mergedIntoId: null,
      AND: [...visibility, where],
    },
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
          credentials: {
            where: { isDefault: true },
            take: 1,
          },
          followers: viewerId
            ? {
                where: { followerId: viewerId },
                select: { followerId: true },
                take: 1,
              }
            : {
                where: { followerId: "__never__" },
                select: { followerId: true },
                take: 0,
              },
          badges: { take: 2, orderBy: { awardedAt: "desc" } },
        },
      },
      topics: {
        include: {
          topic: {
            include: {
              followers: viewerId
                ? {
                    where: { userId: viewerId },
                    select: { userId: true },
                    take: 1,
                  }
                : {
                    where: { userId: "__never__" },
                    select: { userId: true },
                    take: 0,
                  },
            },
          },
        },
      },
      answers: {
        where: { deletedAt: null, isHidden: false },
        orderBy: [{ score: "desc" }, { createdAt: "asc" }],
        take: 1,
        select: { content: true, commentCount: true },
      },
      votes: viewerId
        ? { where: { userId: viewerId }, select: { value: true }, take: 1 }
        : { where: { id: "__never__" }, select: { value: true }, take: 1 },
      bookmarks: viewerId
        ? { where: { userId: viewerId }, select: { id: true }, take: 1 }
        : { where: { id: "__never__" }, select: { id: true }, take: 1 },
      followers: viewerId
        ? { where: { userId: viewerId }, select: { userId: true }, take: 1 }
        : { where: { userId: "__never__" }, select: { userId: true }, take: 0 },
      spaceLinks: {
        where: { status: "APPROVED", space: { deletedAt: null } },
        include: { space: { select: { name: true, slug: true } } },
        take: 3,
      },
      _count: { select: { followers: true } },
    },
    orderBy,
    skip: boundedSkip,
    take: boundedTake,
  });
}

export async function getFeedQuestions(options: {
  viewerId?: string;
  take?: number;
  skip?: number;
  filter?: "for-you" | "following" | "trending" | "unanswered";
}) {
  const filter = options.filter ?? "for-you";
  const requestedTake = Math.min(Math.max(options.take ?? PAGE_SIZE, 1), 50);
  const requestedSkip = Math.max(options.skip ?? 0, 0);
  const where =
    filter === "following" && options.viewerId
      ? {
          OR: [
            { followers: { some: { userId: options.viewerId } } },
            {
              topics: {
                some: {
                  topic: { followers: { some: { userId: options.viewerId } } },
                },
              },
            },
            {
              author: { followers: { some: { followerId: options.viewerId } } },
            },
          ],
        }
      : filter === "unanswered"
        ? { answerCount: 0 }
        : {};
  const orderBy =
    filter === "trending"
      ? [{ score: "desc" as const }, { viewCount: "desc" as const }]
      : [{ createdAt: "desc" as const }, { score: "desc" as const }];
  const personalized = filter === "for-you" && Boolean(options.viewerId);
  const candidateTake = personalized
    ? Math.min(160, Math.max(60, requestedSkip + requestedTake * 5))
    : requestedTake;
  const [records, affinities, views] = await Promise.all([
    getFeedRecords({
      viewerId: options.viewerId,
      take: candidateTake,
      skip: personalized ? 0 : requestedSkip,
      where,
      orderBy,
    }),
    personalized
      ? prisma.userTopicAffinity.findMany({
          where: { userId: options.viewerId },
          select: { topicId: true, weight: true },
          orderBy: { weight: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    personalized
      ? prisma.questionView.findMany({
          where: { userId: options.viewerId },
          select: { questionId: true, count: true, lastViewedAt: true },
          orderBy: { lastViewedAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
  ]);
  const items = records.map(mapFeedQuestion);
  if (personalized) {
    const topicAffinities = new Map(
      affinities.map((item) => [item.topicId, item.weight]),
    );
    const viewedQuestions = new Map(
      views.map((item) => [
        item.questionId,
        { count: item.count, lastViewedAt: item.lastViewedAt },
      ]),
    );
    return items
      .sort(
        (a, b) =>
          scorePersonalizedFeed(b, { topicAffinities, viewedQuestions }) -
          scorePersonalizedFeed(a, { topicAffinities, viewedQuestions }),
      )
      .slice(requestedSkip, requestedSkip + requestedTake);
  }
  return items;
}

function notificationType(type: NotificationType): NotificationItem["type"] {
  switch (type) {
    case "NEW_ANSWER":
      return "answer";
    case "ANSWER_REQUEST":
      return "answer-request";
    case "ACCEPTED_ANSWER":
      return "accepted";
    case "SPACE_POST":
      return "space";
    case "NEW_FOLLOWER":
      return "follow";
    case "UPVOTE":
      return "upvote";
    case "MENTION":
      return "mention";
    case "MODERATION":
      return "moderation";
    default:
      return "comment";
  }
}

export async function getBookmarkedQuestions(viewerId: string) {
  const bookmarks = await prisma.bookmark.findMany({
    where: {
      userId: viewerId,
      OR: [
        { question: { deletedAt: null, isHidden: false } },
        {
          answer: {
            deletedAt: null,
            isHidden: false,
            question: { deletedAt: null, isHidden: false },
          },
        },
      ],
    },
    include: {
      answer: {
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
          votes: {
            where: { userId: viewerId },
            select: { value: true },
            take: 1,
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const questionIds = Array.from(
    new Set(
      bookmarks
        .map((bookmark) => bookmark.questionId ?? bookmark.answer?.questionId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  if (!questionIds.length) return [];
  const records = await getFeedRecords({
    viewerId,
    where: { id: { in: questionIds } },
    take: questionIds.length,
  });
  const byId = new Map(records.map((record) => [record.id, record]));
  return bookmarks.flatMap((bookmark) => {
    const questionId = bookmark.questionId ?? bookmark.answer?.questionId;
    const record = questionId ? byId.get(questionId) : undefined;
    if (!record) return [];
    const base = mapFeedQuestion(record);
    if (!bookmark.answer)
      return [
        {
          ...base,
          bookmarkId: bookmark.id,
          collectionId: bookmark.collectionId,
          bookmarked: true,
        },
      ];
    return [
      {
        ...base,
        answer: bookmark.answer.content,
        author: authorFrom(bookmark.answer.author),
        bookmarkAnswerId: bookmark.answer.id,
        voteAnswerId: bookmark.answer.id,
        bookmarkId: bookmark.id,
        collectionId: bookmark.collectionId,
        bookmarked: true,
        comments: bookmark.answer.commentCount,
        publishedAt: bookmark.answer.createdAt.toISOString(),
        score: bookmark.answer.score,
        userVote: voteValue(bookmark.answer.votes),
      },
    ];
  });
}

export async function getTopicQuestions(topicId: string, viewerId?: string) {
  const records = await getFeedRecords({
    viewerId,
    where: { topics: { some: { topicId } } },
    orderBy: [{ createdAt: "desc" }],
  });
  return records.map(mapFeedQuestion);
}

export async function getUserQuestions(authorId: string, viewerId?: string) {
  const records = await getFeedRecords({
    viewerId,
    where: { authorId },
    orderBy: [{ createdAt: "desc" }],
  });
  return records.map(mapFeedQuestion);
}

export async function getAnswerRequests(viewerId: string) {
  const direct = await prisma.answerRequest.findMany({
    where: {
      requestedUserId: viewerId,
      status: "PENDING",
      question: {
        deletedAt: null,
        isHidden: false,
        answers: { none: { authorId: viewerId, deletedAt: null } },
      },
    },
    include: {
      requester: {
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
      requestedUser: {
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
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const requestedIds = direct.map((item) => item.questionId);
  const requestRecords = requestedIds.length
    ? await getFeedRecords({
        viewerId,
        where: { id: { in: requestedIds } },
        take: requestedIds.length,
      })
    : [];
  const byQuestionId = new Map(
    requestRecords.map((record) => [record.id, mapFeedQuestion(record)]),
  );
  const requests = direct.flatMap((item): AnswerRequestQueueItem[] => {
    const question = byQuestionId.get(item.questionId);
    if (!question) return [];
    return [
      {
        id: item.id,
        questionId: question.id,
        questionSlug: question.slug,
        questionTitle: question.title,
        requester: authorFrom(item.requester),
        requestedUser: authorFrom(item.requestedUser),
        status: item.status,
        message: item.message,
        createdAt: item.createdAt.toISOString(),
        question,
      },
    ];
  });

  const suggestionRecords = await getFeedRecords({
    viewerId,
    where: {
      id: requestedIds.length ? { notIn: requestedIds } : undefined,
      answers: { none: { authorId: viewerId, deletedAt: null } },
    },
    orderBy: [{ answerCount: "asc" }, { createdAt: "desc" }],
    take: 12,
  });
  return { requests, suggestions: suggestionRecords.map(mapFeedQuestion) };
}

export async function getQuestionDetail(
  slug: string,
  viewerId?: string,
  viewerRole?: Role,
  trackView = false,
): Promise<QuestionDetailData | null> {
  const record = await prisma.question.findFirst({
    where: {
      slug,
      deletedAt: null,
      mergedIntoId: null,
      isHidden:
        viewerRole === "ADMIN" || viewerRole === "MODERATOR"
          ? undefined
          : false,
    },
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
      votes: viewerId
        ? { where: { userId: viewerId }, select: { value: true }, take: 1 }
        : { where: { id: "__never__" }, select: { value: true }, take: 1 },
      bookmarks: viewerId
        ? { where: { userId: viewerId }, select: { id: true }, take: 1 }
        : { where: { id: "__never__" }, select: { id: true }, take: 1 },
      followers: viewerId
        ? { where: { userId: viewerId }, select: { userId: true }, take: 1 }
        : { where: { userId: "__never__" }, select: { userId: true }, take: 0 },
      answers: {
        where: {
          deletedAt: null,
          isHidden:
            viewerRole === "ADMIN" || viewerRole === "MODERATOR"
              ? undefined
              : false,
        },
        orderBy: [{ score: "desc" }, { createdAt: "asc" }],
        take: 50,
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
          credential: { select: { label: true } },
          votes: viewerId
            ? { where: { userId: viewerId }, select: { value: true }, take: 1 }
            : { where: { id: "__never__" }, select: { value: true }, take: 1 },
          bookmarks: viewerId
            ? { where: { userId: viewerId }, select: { id: true }, take: 1 }
            : { where: { id: "__never__" }, select: { id: true }, take: 1 },
          comments: {
            where: {
              deletedAt: null,
              isHidden:
                viewerRole === "ADMIN" || viewerRole === "MODERATOR"
                  ? undefined
                  : false,
            },
            orderBy: [{ createdAt: "asc" }],
            take: 100,
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
              votes: viewerId
                ? {
                    where: { userId: viewerId },
                    select: { value: true },
                    take: 1,
                  }
                : {
                    where: { id: "__never__" },
                    select: { value: true },
                    take: 1,
                  },
            },
          },
        },
      },
      answerRequests: {
        where: { status: "PENDING" },
        include: {
          requester: {
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
          requestedUser: {
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
        orderBy: { createdAt: "desc" },
        take: 8,
      },
      spaceLinks: {
        where: { status: "APPROVED", space: { deletedAt: null } },
        include: { space: { select: { name: true, slug: true } } },
      },
      _count: { select: { followers: true } },
    },
  });
  if (!record) return null;
  const viewCount = trackView
    ? (
        await prisma.question.update({
          where: { id: record.id },
          data: { viewCount: { increment: 1 } },
          select: { viewCount: true },
        })
      ).viewCount
    : record.viewCount;
  if (trackView && viewerId && viewerId !== record.authorId)
    void recordQuestionView({
      userId: viewerId,
      questionId: record.id,
      topicIds: record.topics.map((item) => item.topicId),
    }).catch(() => undefined);
  const canChooseBestAnswer = viewerId === record.authorId;
  const canEditQuestion = canChooseBestAnswer || canModerate(viewerRole);
  const answersList: AnswerSummary[] = record.answers.map((answer) => {
    const author = authorFrom(answer.author);
    return {
      id: answer.id,
      content: answer.content,
      credentialId: answer.credentialId,
      author: {
        ...author,
        credential: answer.credential?.label ?? author.credential,
        headline: answer.credential?.label ?? author.headline,
      },
      score: answer.score,
      userVote: voteValue(answer.votes),
      bookmarked: answer.bookmarks.length > 0,
      createdAt: answer.createdAt.toISOString(),
      commentCount: answer.commentCount,
      canEdit: viewerId === answer.authorId,
      canAccept: canChooseBestAnswer && viewerId !== answer.authorId,
      accepted: record.acceptedAnswerId === answer.id,
      comments: buildCommentTree(answer.comments, viewerId, viewerRole),
    };
  });
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    description: record.description ?? "",
    topics: record.topics.map((item) => item.topic.name),
    author: authorFrom(record.author),
    authorId: record.authorId,
    answer: answersList[0]?.content ?? record.description ?? "",
    publishedAt: record.createdAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    score: record.score,
    comments: answersList.reduce(
      (count, answer) => count + answer.commentCount,
      0,
    ),
    views: viewCount,
    answers: record.answerCount,
    acceptedAnswerId: record.acceptedAnswerId,
    followed: record.followers.length > 0,
    bookmarked: record.bookmarks.length > 0,
    userVote: voteValue(record.votes),
    followerCount: record._count.followers,
    spaces: record.spaceLinks.map((link) => link.space),
    topicItems: record.topics.map((item, index) =>
      topicSummaryFrom(item.topic, index),
    ),
    answerRequests: record.answerRequests.map(
      (item): AnswerRequestItem => ({
        id: item.id,
        questionId: record.id,
        questionSlug: record.slug,
        questionTitle: record.title,
        requester: authorFrom(item.requester),
        requestedUser: authorFrom(item.requestedUser),
        status: item.status,
        message: item.message,
        createdAt: item.createdAt.toISOString(),
      }),
    ),
    answersList,
    canEdit: canEditQuestion,
    canDelete: viewerId === record.authorId,
    hasAnswered: answersList.some((answer) => answer.author.id === viewerId),
  };
}

type CommentWithReplies = {
  id: string;
  content: string;
  score: number;
  createdAt: Date;
  parentId: string | null;
  authorId: string;
  author: Parameters<typeof authorFrom>[0];
  votes: { value: VoteValue }[];
  replies?: CommentWithReplies[];
};

function mapComment(
  comment: CommentWithReplies,
  viewerId?: string,
  viewerRole?: Role,
): CommentSummary {
  return {
    id: comment.id,
    content: comment.content,
    score: comment.score,
    createdAt: comment.createdAt.toISOString(),
    parentId: comment.parentId,
    author: authorFrom(comment.author),
    userVote: voteValue(comment.votes),
    canEdit: viewerId === comment.authorId,
    replies:
      comment.replies?.map((reply) =>
        mapComment(reply, viewerId, viewerRole),
      ) ?? [],
  };
}

function buildCommentTree(
  comments: CommentWithReplies[],
  viewerId?: string,
  viewerRole?: Role,
) {
  const summaries = new Map<string, CommentSummary>();
  for (const comment of comments)
    summaries.set(comment.id, {
      ...mapComment(comment, viewerId, viewerRole),
      replies: [],
    });
  const roots: CommentSummary[] = [];
  for (const comment of comments) {
    const summary = summaries.get(comment.id)!;
    const parent = comment.parentId
      ? summaries.get(comment.parentId)
      : undefined;
    if (parent) (parent.replies ??= []).push(summary);
    else roots.push(summary);
  }
  return roots;
}

export async function getTopicView(slug: string, viewerId?: string) {
  const topic = await prisma.topic.findFirst({
    where: { slug, deletedAt: null },
    include: {
      followers: viewerId
        ? { where: { userId: viewerId }, take: 1 }
        : { where: { userId: "__never__" }, take: 1 },
    },
  });
  if (!topic) return null;
  const [questions, related, contributors] = await Promise.all([
    getTopicQuestions(topic.id, viewerId),
    prisma.topic.findMany({
      where: { deletedAt: null, id: { not: topic.id } },
      orderBy: { followerCount: "desc" },
      take: 4,
    }),
    prisma.answer.groupBy({
      by: ["authorId"],
      where: {
        deletedAt: null,
        isHidden: false,
        author: {
          suspendedAt: null,
          deletedAt: null,
          OR: [
            { preference: { is: null } },
            { preference: { is: { profilePublic: true } } },
          ],
        },
        question: {
          deletedAt: null,
          isHidden: false,
          topics: { some: { topicId: topic.id } },
        },
      },
      _count: { _all: true },
      orderBy: { _count: { authorId: "desc" } },
      take: 3,
    }),
  ]);
  const users = contributors.length
    ? await prisma.user.findMany({
        where: { id: { in: contributors.map((item) => item.authorId) } },
        select: {
          id: true,
          name: true,
          username: true,
          image: true,
          role: true,
          occupation: true,
          bio: true,
        },
      })
    : [];
  const summary: TopicSummary = {
    id: topic.id,
    slug: topic.slug,
    name: topic.name,
    description: topic.description,
    followers: topic.followerCount,
    questions: topic.questionCount,
    accent: topic.color ?? colorFor(topic.name.length),
    icon: iconFor(topic.name),
    followed: topic.followers.length > 0,
  };
  return {
    topic: summary,
    questions,
    related: related.map((item, index) => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      description: item.description,
      followers: item.followerCount,
      questions: item.questionCount,
      accent: item.color ?? colorFor(index),
      icon: iconFor(item.name),
    })),
    contributors: users.map((user) => ({
      ...authorFrom(user),
      answers:
        contributors.find((item) => item.authorId === user.id)?._count._all ??
        0,
    })),
  };
}

export async function getProfileView(
  username: string,
  viewerId?: string,
  viewerRole?: Role,
) {
  const user = await prisma.user.findFirst({
    where: {
      username,
      deletedAt: null,
      suspendedAt:
        viewerRole === "ADMIN" || viewerRole === "MODERATOR" ? undefined : null,
    },
    include: {
      followers: viewerId
        ? { where: { followerId: viewerId }, take: 1 }
        : { where: { followerId: "__never__" }, take: 1 },
      topicFollows: { include: { topic: true }, take: 6 },
      _count: { select: { followers: true, answers: true, questions: true } },
      credentials: {
        include: { topic: { select: { id: true, name: true, slug: true } } },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
      },
      badges: { take: 6, orderBy: { awardedAt: "desc" } },
      preference: true,
    },
  });
  if (!user) return null;
  const ownProfile = viewerId === user.id;
  const privileged = viewerRole === "ADMIN" || viewerRole === "MODERATOR";
  if (
    user.preference &&
    !user.preference.profilePublic &&
    !ownProfile &&
    !privileged
  )
    return null;
  const showActivity =
    ownProfile || privileged || user.preference?.showActivity !== false;
  const [questions, answers, acceptedAnswers, profileViews] = await Promise.all(
    [
      showActivity ? getUserQuestions(user.id, viewerId) : Promise.resolve([]),
      prisma.answer.findMany({
        where: {
          authorId: user.id,
          deletedAt: null,
          isHidden: false,
          id: showActivity ? undefined : "__hidden__",
        },
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
              followers: viewerId
                ? {
                    where: { followerId: viewerId },
                    select: { followerId: true },
                    take: 1,
                  }
                : {
                    where: { followerId: "__never__" },
                    select: { followerId: true },
                    take: 0,
                  },
              badges: { take: 2, orderBy: { awardedAt: "desc" } },
            },
          },
          votes: viewerId
            ? { where: { userId: viewerId }, select: { value: true }, take: 1 }
            : { where: { id: "__never__" }, select: { value: true }, take: 1 },
          bookmarks: viewerId
            ? { where: { userId: viewerId }, select: { id: true }, take: 1 }
            : { where: { id: "__never__" }, select: { id: true }, take: 1 },
          question: {
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
                  followers: viewerId
                    ? {
                        where: { followerId: viewerId },
                        select: { followerId: true },
                        take: 1,
                      }
                    : {
                        where: { followerId: "__never__" },
                        select: { followerId: true },
                        take: 0,
                      },
                  badges: { take: 2, orderBy: { awardedAt: "desc" } },
                },
              },
              topics: {
                include: {
                  topic: {
                    include: {
                      followers: viewerId
                        ? {
                            where: { userId: viewerId },
                            select: { userId: true },
                            take: 1,
                          }
                        : {
                            where: { userId: "__never__" },
                            select: { userId: true },
                            take: 0,
                          },
                    },
                  },
                },
              },
              answers: {
                where: { id: "__never__" },
                take: 1,
                select: { content: true, commentCount: true },
              },
              votes: {
                where: { id: "__never__" },
                take: 1,
                select: { value: true },
              },
              bookmarks: {
                where: { id: "__never__" },
                take: 1,
                select: { id: true },
              },
              followers: {
                where: { userId: "__never__" },
                take: 1,
                select: { userId: true },
              },
              spaceLinks: {
                where: { status: "APPROVED", space: { deletedAt: null } },
                include: { space: { select: { name: true, slug: true } } },
                take: 3,
              },
              _count: { select: { followers: true } },
            },
          },
        },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        take: 5,
      }),
      prisma.answer.count({
        where: {
          authorId: user.id,
          deletedAt: null,
          isHidden: false,
          acceptedFor: { isNot: null },
        },
      }),
      prisma.question.aggregate({
        where: {
          authorId: user.id,
          deletedAt: null,
          isHidden: false,
        },
        _sum: { viewCount: true },
      }),
    ],
  );
  const person: PersonSummary = {
    ...authorFrom(user),
    followers: user._count.followers,
    answers: user._count.answers,
    questions: user._count.questions,
    expertise: showActivity
      ? user.topicFollows.map((item) => item.topic.name).slice(0, 6)
      : [],
    reputation: user.reputation,
    following: user.followers.length > 0,
    bio: user.bio ?? undefined,
    occupation: user.occupation ?? undefined,
    location: user.location ?? undefined,
    website: user.website ?? undefined,
    joinedAt: user.createdAt.toISOString(),
    credentials: user.credentials.map((credential) => ({
      id: credential.id,
      label: credential.label,
      organization: credential.organization,
      topic: credential.topic,
      url: credential.url,
      isDefault: credential.isDefault,
    })),
    badges: user.badges.map((badge) => badge.label),
    acceptedAnswers,
    profileViews: profileViews._sum.viewCount ?? 0,
  };
  return {
    person,
    questions,
    answers: answers.map((item) => {
      const base = mapFeedQuestion(item.question);
      return {
        ...base,
        answer: item.content,
        author: authorFrom(item.author),
        bookmarkAnswerId: item.id,
        voteAnswerId: item.id,
        bookmarked: item.bookmarks.length > 0,
        comments: item.commentCount,
        publishedAt: item.createdAt.toISOString(),
        createdAt: item.createdAt.toISOString(),
        score: item.score,
        userVote: voteValue(item.votes),
      };
    }),
  };
}

export async function getNotifications(
  viewerId: string,
): Promise<NotificationItem[]> {
  const notifications = await prisma.notification.findMany({
    where: { recipientId: viewerId },
    include: {
      actor: { select: { name: true, image: true } },
      question: { select: { slug: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return notifications.map((notification) => ({
    id: notification.id,
    type: notificationType(notification.type),
    actorName: notification.actor?.name ?? "QueryHub",
    actorAvatar: notification.actor?.image,
    message: notification.message,
    detail: notification.question?.title ?? "Account activity",
    href: notification.question
      ? `/question/${notification.question.slug}`
      : "/notifications",
    createdAt: notification.createdAt.toISOString(),
    read: Boolean(notification.readAt),
  }));
}

export async function getUnreadNotificationCount(viewerId: string) {
  return prisma.notification.count({
    where: { recipientId: viewerId, readAt: null },
  });
}

type AdminKind = "users" | "content" | "reports" | "topics";

type AdminRowsOptions = {
  query?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sort?: "asc" | "desc";
  actorId?: string;
  actorRole?: Role;
};

function adminPaging(options: AdminRowsOptions = {}) {
  const pageSize = Math.min(Math.max(options.pageSize ?? 10, 5), 50);
  const page = Math.max(1, options.page ?? 1);
  return {
    query: options.query?.trim() ?? "",
    status: options.status?.trim() || "All",
    page,
    pageSize,
    sort: options.sort ?? "desc",
    skip: (page - 1) * pageSize,
  };
}

function reportStatusFilter(status: string) {
  if (status === "Pending") return "PENDING" as const;
  if (status === "Reviewing") return "REVIEWING" as const;
  if (status === "Actioned") return "ACTIONED" as const;
  if (status === "Dismissed") return "DISMISSED" as const;
  return undefined;
}

function manageableRoleFilter(actorRole?: Role) {
  if (actorRole === "ADMIN") return ["USER", "MODERATOR"] as const;
  if (actorRole === "MODERATOR") return ["USER"] as const;
  return undefined;
}

export async function getAdminRowsPage(
  kind: AdminKind,
  options: AdminRowsOptions = {},
): Promise<AdminRowsPage> {
  const paging = adminPaging(options);
  if (kind === "users") {
    const roles = manageableRoleFilter(options.actorRole);
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(options.actorId ? { id: { not: options.actorId } } : {}),
      ...(roles ? { role: { in: [...roles] } } : {}),
      ...(paging.status === "Suspended"
        ? { suspendedAt: { not: null } }
        : paging.status === "Active"
          ? { suspendedAt: null }
          : {}),
      ...(paging.query
        ? {
            OR: [
              { name: { contains: paging.query, mode: "insensitive" } },
              { email: { contains: paging.query, mode: "insensitive" } },
              { username: { contains: paging.query, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: [{ name: paging.sort }, { createdAt: "desc" }],
        skip: paging.skip,
        take: paging.pageSize,
      }),
    ]);
    return {
      rows: users.map((user) => ({
        id: user.id,
        primary: user.name,
        secondary: user.email,
        meta: user.role,
        status: user.suspendedAt ? "Suspended" : "Active",
        date: user.createdAt.toISOString(),
        avatar: user.image,
        href: `/profile/${user.username}`,
        target: "user",
      })),
      total,
      page: paging.page,
      pageSize: paging.pageSize,
      query: paging.query,
      status: paging.status,
      sort: paging.sort,
    };
  }
  if (kind === "topics") {
    const where: Prisma.TopicWhereInput = {
      ...(paging.status === "Hidden"
        ? { deletedAt: { not: null } }
        : paging.status === "Active"
          ? { deletedAt: null }
          : {}),
      ...(paging.query
        ? {
            OR: [
              { name: { contains: paging.query, mode: "insensitive" } },
              { description: { contains: paging.query, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, topics] = await Promise.all([
      prisma.topic.count({ where }),
      prisma.topic.findMany({
        where,
        orderBy: [{ name: paging.sort }, { followerCount: "desc" }],
        skip: paging.skip,
        take: paging.pageSize,
      }),
    ]);
    return {
      rows: topics.map((topic) => ({
        id: topic.id,
        primary: topic.name,
        secondary: topic.description,
        meta: `${topic.questionCount.toLocaleString()} questions`,
        status: topic.deletedAt ? "Hidden" : "Active",
        date: `${topic.followerCount.toLocaleString()} followers`,
        href: topic.deletedAt ? undefined : `/topic/${topic.slug}`,
        target: "topic",
      })),
      total,
      page: paging.page,
      pageSize: paging.pageSize,
      query: paging.query,
      status: paging.status,
      sort: paging.sort,
    };
  }
  if (kind === "reports") {
    const status = reportStatusFilter(paging.status);
    const where: Prisma.ReportWhereInput = {
      ...(status ? { status } : {}),
      ...(paging.query
        ? {
            OR: [
              { details: { contains: paging.query, mode: "insensitive" } },
              {
                moderatorNote: {
                  contains: paging.query,
                  mode: "insensitive",
                },
              },
              {
                reporter: {
                  name: { contains: paging.query, mode: "insensitive" },
                },
              },
              {
                question: {
                  title: { contains: paging.query, mode: "insensitive" },
                },
              },
              {
                answer: {
                  content: { contains: paging.query, mode: "insensitive" },
                },
              },
              {
                comment: {
                  content: { contains: paging.query, mode: "insensitive" },
                },
              },
              {
                profile: {
                  name: { contains: paging.query, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    };
    const [total, reports] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.findMany({
        where,
        include: {
          reporter: true,
          question: true,
          answer: { include: { question: true, author: true } },
          comment: {
            include: {
              author: true,
              answer: { include: { question: true } },
            },
          },
          profile: true,
          actions: {
            include: { moderator: { select: { name: true } } },
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
        orderBy: { createdAt: paging.sort },
        skip: paging.skip,
        take: paging.pageSize,
      }),
    ]);
    return {
      rows: reports.map((report) => {
        const href = report.question
          ? `/question/${report.question.slug}`
          : report.answer
            ? `/question/${report.answer.question.slug}`
            : report.comment
              ? `/question/${report.comment.answer.question.slug}`
              : report.profile
                ? `/profile/${report.profile.username}`
                : undefined;
        const targetPreview = report.question
          ? report.question.title
          : report.answer
            ? report.answer.content.slice(0, 140)
            : report.comment
              ? report.comment.content.slice(0, 140)
              : report.profile
                ? `${report.profile.name} (@${report.profile.username})`
                : "Unknown target";
        const targetLabel = report.question
          ? "Question"
          : report.answer
            ? "Answer"
            : report.comment
              ? "Comment"
              : "Profile";
        const latestNote = report.moderatorNote ?? report.actions[0]?.note;
        return {
          id: report.id,
          primary: report.details || targetPreview,
          secondary: `Reported by ${report.reporter.name} - ${targetLabel}: ${targetPreview}`,
          meta: `${report.reason.replace("_", " ")}${
            latestNote ? ` - Note: ${latestNote.slice(0, 80)}` : ""
          }`,
          status:
            report.status === "PENDING"
              ? "Pending"
              : report.status === "REVIEWING"
                ? "Reviewing"
                : report.status === "DISMISSED"
                  ? "Dismissed"
                  : "Actioned",
          date: report.createdAt.toISOString(),
          href,
          target: report.questionId
            ? "question"
            : report.answerId
              ? "answer"
              : report.commentId
                ? "comment"
                : "user",
        };
      }),
      total,
      page: paging.page,
      pageSize: paging.pageSize,
      query: paging.query,
      status: paging.status,
      sort: paging.sort,
    };
  }
  const questionStatus: Prisma.QuestionWhereInput =
    paging.status === "Published"
      ? { deletedAt: null, isHidden: false, mergedIntoId: null }
      : paging.status === "Hidden"
        ? { isHidden: true }
        : paging.status === "Deleted"
          ? { deletedAt: { not: null } }
          : paging.status === "Merged"
            ? { mergedIntoId: { not: null } }
            : {};
  const answerStatus: Prisma.AnswerWhereInput =
    paging.status === "Published"
      ? { deletedAt: null, isHidden: false }
      : paging.status === "Hidden"
        ? { isHidden: true }
        : paging.status === "Deleted"
          ? { deletedAt: { not: null } }
          : paging.status === "Merged"
            ? { id: "__never__" }
            : {};
  const questionWhere: Prisma.QuestionWhereInput = {
    ...questionStatus,
    ...(paging.query
      ? {
          OR: [
            { title: { contains: paging.query, mode: "insensitive" } },
            { description: { contains: paging.query, mode: "insensitive" } },
            {
              author: {
                name: { contains: paging.query, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };
  const answerWhere: Prisma.AnswerWhereInput = {
    ...answerStatus,
    ...(paging.query
      ? {
          OR: [
            { content: { contains: paging.query, mode: "insensitive" } },
            {
              author: {
                name: { contains: paging.query, mode: "insensitive" },
              },
            },
            {
              question: {
                title: { contains: paging.query, mode: "insensitive" },
              },
            },
          ],
        }
      : {}),
  };
  const contentTake = paging.skip + paging.pageSize;
  const [questionCount, answerCount, questions, answers] = await Promise.all([
    prisma.question.count({ where: questionWhere }),
    prisma.answer.count({ where: answerWhere }),
    prisma.question.findMany({
      where: questionWhere,
      include: { author: true },
      orderBy: { createdAt: paging.sort },
      take: contentTake,
    }),
    prisma.answer.findMany({
      where: answerWhere,
      include: { author: true, question: true },
      orderBy: { createdAt: paging.sort },
      take: contentTake,
    }),
  ]);
  const rows = [
    ...questions.map((question) => ({
      id: question.id,
      primary: question.title,
      secondary: `by ${question.author.name}`,
      meta: "Question",
      status: question.mergedIntoId
        ? "Merged"
        : question.isHidden
          ? "Hidden"
          : question.deletedAt
            ? "Deleted"
            : "Published",
      date: question.createdAt.toISOString(),
      href: `/question/${question.slug}`,
      target: "question" as const,
    })),
    ...answers.map((answer) => ({
      id: answer.id,
      primary: answer.content.slice(0, 120),
      secondary: `by ${answer.author.name} on ${answer.question.title}`,
      meta: "Answer",
      status: answer.isHidden
        ? "Hidden"
        : answer.deletedAt
          ? "Deleted"
          : "Published",
      date: answer.createdAt.toISOString(),
      href: `/question/${answer.question.slug}`,
      target: "answer" as const,
    })),
  ].sort((a, b) =>
    paging.sort === "asc"
      ? new Date(a.date).getTime() - new Date(b.date).getTime()
      : new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  return {
    rows: rows.slice(paging.skip, paging.skip + paging.pageSize),
    total: questionCount + answerCount,
    page: paging.page,
    pageSize: paging.pageSize,
    query: paging.query,
    status: paging.status,
    sort: paging.sort,
  };
}

export async function getAdminRows(kind: AdminKind): Promise<AdminRow[]> {
  return (await getAdminRowsPage(kind, { pageSize: 100 })).rows;
}

export async function getUserCredentials(
  userId: string,
): Promise<CredentialSummary[]> {
  const credentials = await prisma.userCredential.findMany({
    where: { userId },
    include: {
      topic: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  return credentials.map((credential) => ({
    id: credential.id,
    label: credential.label,
    organization: credential.organization,
    topic: credential.topic,
    url: credential.url,
    isDefault: credential.isDefault,
  }));
}

export async function getBookmarkCollections(
  userId: string,
): Promise<BookmarkCollectionSummary[]> {
  const collections = await prisma.bookmarkCollection.findMany({
    where: { userId },
    include: { _count: { select: { bookmarks: true } } },
    orderBy: [{ updatedAt: "desc" }],
  });
  return collections.map((collection) => ({
    id: collection.id,
    name: collection.name,
    description: collection.description,
    count: collection._count.bookmarks,
    createdAt: collection.createdAt.toISOString(),
  }));
}

export async function getSpaces(viewerId?: string): Promise<SpaceSummary[]> {
  const spaces = await prisma.space.findMany({
    where: { deletedAt: null },
    include: {
      members: viewerId
        ? { where: { userId: viewerId }, select: { role: true }, take: 1 }
        : { where: { userId: "__never__" }, select: { role: true }, take: 0 },
    },
    orderBy: [{ followerCount: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  return spaces.map((space) => ({
    id: space.id,
    slug: space.slug,
    name: space.name,
    description: space.description,
    color: space.color,
    image: space.image,
    followers: space.followerCount,
    questions: space.questionCount,
    rules: space.rules,
    allowMemberSubmissions: space.allowMemberSubmissions,
    requireApproval: space.requireApproval,
    joined: space.members.length > 0,
    role: space.members[0]?.role,
  }));
}

export async function getSpaceInvites(
  viewerId: string,
): Promise<SpaceInviteSummary[]> {
  const invites = await prisma.spaceInvite.findMany({
    where: {
      inviteeId: viewerId,
      status: "PENDING",
      space: { deletedAt: null },
    },
    include: {
      space: true,
      inviter: {
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
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return invites.map((invite) => ({
    id: invite.id,
    role: invite.role,
    message: invite.message,
    createdAt: invite.createdAt.toISOString(),
    inviter: authorFrom(invite.inviter),
    space: {
      id: invite.space.id,
      slug: invite.space.slug,
      name: invite.space.name,
      description: invite.space.description,
      color: invite.space.color,
    },
  }));
}

export async function getSpaceView(
  slug: string,
  viewerId?: string,
): Promise<SpaceViewData | null> {
  const space = await prisma.space.findFirst({
    where: { slug, deletedAt: null },
    include: {
      members: {
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: {
          user: {
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
        },
        take: 8,
      },
    },
  });
  if (!space) return null;

  const viewerMembership = viewerId
    ? await prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId: space.id, userId: viewerId } },
      })
    : null;
  const canModerateSpace = ["OWNER", "MODERATOR"].includes(
    viewerMembership?.role ?? "",
  );
  const [approvedRecords, pendingRecords, myQuestionRecords] =
    await Promise.all([
      getFeedRecords({
        viewerId,
        where: {
          spaceLinks: {
            some: { spaceId: space.id, status: "APPROVED" },
          },
        },
        orderBy: [{ createdAt: "desc" }],
        take: 30,
      }),
      canModerateSpace
        ? getFeedRecords({
            viewerId,
            where: {
              spaceLinks: {
                some: { spaceId: space.id, status: "SUBMITTED" },
              },
            },
            orderBy: [{ createdAt: "desc" }],
            take: 20,
          })
        : Promise.resolve([]),
      viewerId
        ? getFeedRecords({
            viewerId,
            where: {
              authorId: viewerId,
              spaceLinks: {
                none: { spaceId: space.id },
              },
            },
            orderBy: [{ createdAt: "desc" }],
            take: 20,
          })
        : Promise.resolve([]),
    ]);

  return {
    space: {
      id: space.id,
      slug: space.slug,
      name: space.name,
      description: space.description,
      color: space.color,
      image: space.image,
      followers: space.followerCount,
      questions: space.questionCount,
      rules: space.rules,
      allowMemberSubmissions: space.allowMemberSubmissions,
      requireApproval: space.requireApproval,
      joined: Boolean(viewerMembership),
      role: viewerMembership?.role,
    },
    questions: approvedRecords.map(mapFeedQuestion),
    pending: pendingRecords.map(mapFeedQuestion),
    myQuestions: myQuestionRecords.map(mapFeedQuestion),
    members: space.members.map((member) => ({
      ...authorFrom(member.user),
      role: member.role,
    })),
  };
}

export async function getOnboardingOptions(userId: string) {
  const [topics, people, user] = await Promise.all([
    prisma.topic.findMany({
      where: { deletedAt: null },
      orderBy: [{ followerCount: "desc" }],
      take: 12,
    }),
    prisma.user.findMany({
      where: {
        id: { not: userId },
        deletedAt: null,
        suspendedAt: null,
        OR: [
          { preference: { is: null } },
          { preference: { is: { profilePublic: true } } },
        ],
      },
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
        _count: { select: { followers: true, answers: true } },
      },
      orderBy: [{ reputation: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { onboardedAt: true },
    }),
  ]);
  return {
    onboarded: Boolean(user?.onboardedAt),
    topics: topics.map(
      (topic, index): TopicSummary => ({
        id: topic.id,
        slug: topic.slug,
        name: topic.name,
        description: topic.description,
        followers: topic.followerCount,
        questions: topic.questionCount,
        accent: topic.color ?? colorFor(index),
        icon: iconFor(topic.name),
      }),
    ),
    people: people.map(
      (person): PersonSummary => ({
        ...authorFrom(person),
        followers: person._count.followers,
        answers: person._count.answers,
        expertise: [],
        reputation: person.reputation,
      }),
    ),
  };
}
