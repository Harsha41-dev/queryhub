import "server-only";

import type { Prisma, Role, VoteValue } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AdminRow,
  AnswerSummary,
  CommentSummary,
  FeedAuthor,
  FeedQuestion,
  NotificationItem,
  PersonSummary,
  QuestionDetailData,
  TopicSummary,
} from "@/lib/types";

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
}): FeedAuthor {
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatar: avatarFor(user.image),
    headline: user.occupation || user.bio || "QueryHub contributor",
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
    userVote: voteValue(record.votes),
    bookmarked: record.bookmarks.length > 0,
    followed: record.followers.length > 0,
    followerCount: record._count.followers,
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
  return prisma.question.findMany({
    where: { deletedAt: null, isHidden: false, ...where },
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
  const records = await getFeedRecords({
    viewerId: options.viewerId,
    take: options.take,
    skip: options.skip,
    where,
    orderBy,
  });
  return records.map(mapFeedQuestion);
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
    if (!bookmark.answer) return [{ ...base, bookmarked: true }];
    return [
      {
        ...base,
        answer: bookmark.answer.content,
        author: authorFrom(bookmark.answer.author),
        bookmarkAnswerId: bookmark.answer.id,
        voteAnswerId: bookmark.answer.id,
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
  const records = await getFeedRecords({
    viewerId,
    where: {
      answers: { none: { authorId: viewerId, deletedAt: null } },
    },
    orderBy: [{ answerCount: "asc" }, { createdAt: "desc" }],
    take: 12,
  });
  return records.map(mapFeedQuestion);
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
            },
          },
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
  const canEditQuestion = viewerId === record.authorId;
  const answersList: AnswerSummary[] = record.answers.map((answer) => ({
    id: answer.id,
    content: answer.content,
    author: authorFrom(answer.author),
    score: answer.score,
    userVote: voteValue(answer.votes),
    bookmarked: answer.bookmarks.length > 0,
    createdAt: answer.createdAt.toISOString(),
    commentCount: answer.commentCount,
    canEdit: viewerId === answer.authorId,
    comments: buildCommentTree(answer.comments, viewerId, viewerRole),
  }));
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
    followed: record.followers.length > 0,
    bookmarked: record.bookmarks.length > 0,
    userVote: voteValue(record.votes),
    followerCount: record._count.followers,
    answersList,
    canEdit: canEditQuestion,
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
        author: { suspendedAt: null, deletedAt: null },
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
  const [questions, answers] = await Promise.all([
    showActivity ? getUserQuestions(user.id, viewerId) : Promise.resolve([]),
    prisma.answer.findMany({
      where: {
        authorId: user.id,
        deletedAt: null,
        isHidden: false,
        id: showActivity ? undefined : "__hidden__",
      },
      include: {
        question: {
          include: {
            author: true,
            topics: { include: { topic: true } },
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
            _count: { select: { followers: true } },
          },
        },
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
  ]);
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
  };
  return {
    person,
    questions,
    answers: answers.map((item) => ({
      ...mapFeedQuestion(item.question),
      answer: item.content,
    })),
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
    type:
      notification.type === "NEW_ANSWER"
        ? "answer"
        : notification.type === "NEW_FOLLOWER"
          ? "follow"
          : notification.type === "UPVOTE"
            ? "upvote"
            : notification.type === "MENTION"
              ? "mention"
              : notification.type === "MODERATION"
                ? "moderation"
                : "comment",
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

export async function getAdminRows(
  kind: "users" | "content" | "reports" | "topics",
): Promise<AdminRow[]> {
  if (kind === "users") {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return users.map((user) => ({
      id: user.id,
      primary: user.name,
      secondary: user.email,
      meta: user.role,
      status: user.suspendedAt ? "Suspended" : "Active",
      date: user.createdAt.toISOString(),
      avatar: user.image,
      href: `/profile/${user.username}`,
      target: "user",
    }));
  }
  if (kind === "topics") {
    const topics = await prisma.topic.findMany({
      orderBy: { followerCount: "desc" },
      take: 100,
    });
    return topics.map((topic) => ({
      id: topic.id,
      primary: topic.name,
      secondary: topic.description,
      meta: `${topic.questionCount.toLocaleString()} questions`,
      status: topic.deletedAt ? "Hidden" : "Active",
      date: `${topic.followerCount.toLocaleString()} followers`,
      href: topic.deletedAt ? undefined : `/topic/${topic.slug}`,
      target: "topic",
    }));
  }
  if (kind === "reports") {
    const reports = await prisma.report.findMany({
      include: {
        reporter: true,
        question: true,
        answer: { include: { question: true } },
        comment: { include: { answer: { include: { question: true } } } },
        profile: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return reports.map((report) => {
      const href = report.question
        ? `/question/${report.question.slug}`
        : report.answer
          ? `/question/${report.answer.question.slug}`
          : report.comment
            ? `/question/${report.comment.answer.question.slug}`
            : report.profile
              ? `/profile/${report.profile.username}`
              : undefined;
      return {
        id: report.id,
        primary: report.details || report.reason.replace("_", " "),
        secondary: `Reported by ${report.reporter.name}`,
        meta: report.reason.replace("_", " "),
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
    });
  }
  const questions = await prisma.question.findMany({
    include: { author: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const answers = await prisma.answer.findMany({
    include: { author: true, question: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return [
    ...questions.map((question) => ({
      id: question.id,
      primary: question.title,
      secondary: `by ${question.author.name}`,
      meta: "Question",
      status: question.isHidden
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
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
