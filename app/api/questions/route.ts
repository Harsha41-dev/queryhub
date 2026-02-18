import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assessUserText } from "@/lib/abuse";
import { trackAnalytics } from "@/lib/analytics";
import { extractMarkdownImageUrls } from "@/lib/content-images";
import { actionError, actionSuccess } from "@/lib/errors";
import { getActiveSession } from "@/lib/session";
import { logger } from "@/lib/logger";
import { extractMentionedUsernames } from "@/lib/mentions";
import { filterNotificationRecipients } from "@/lib/notification-mutes";
import { recordTopicAffinity } from "@/lib/personalization";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  clientRateLimitKey,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import {
  questionQualityWarnings,
  similarityRatio,
  tokenizeSearch,
} from "@/lib/text-intelligence";
import { slugify } from "@/lib/utils";
import { questionSchema } from "@/lib/validators";

const topicAccents = ["#4f46e5", "#0891b2", "#16a34a", "#c2410c"];

export async function GET(request: Request) {
  const optionsLimit = await checkRateLimit(
    `question-options:${clientRateLimitKey(request)}`,
    120,
    60_000,
  );
  if (!optionsLimit.allowed) return rateLimitResponse(optionsLimit);

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length > 240)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "The question is too long."),
      { status: 400 },
    );

  const terms = tokenizeSearch(query).slice(0, 6);

  const [topics, suggestions] = await prisma.$transaction([
    prisma.topic.findMany({
      where: { deletedAt: null },
      orderBy: [{ followerCount: "desc" }, { name: "asc" }],
      take: 50,
    }),
    terms.length
      ? prisma.question.findMany({
          where: {
            deletedAt: null,
            isHidden: false,
            mergedIntoId: null,
            OR: [
              { title: { contains: query, mode: "insensitive" } },
              ...terms.flatMap((term) => [
                { title: { contains: term, mode: "insensitive" as const } },
                {
                  description: {
                    contains: term,
                    mode: "insensitive" as const,
                  },
                },
              ]),
            ],
          },
          select: { id: true, slug: true, title: true, description: true },
          orderBy: [{ score: "desc" }, { createdAt: "desc" }],
          take: 12,
        })
      : prisma.question.findMany({
          where: { id: "__never__" },
          select: { id: true, slug: true, title: true, description: true },
          take: 0,
        }),
  ]);
  const rankedSuggestions = suggestions
    .map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      score: Math.max(
        similarityRatio(query, item.title),
        similarityRatio(query, `${item.title} ${item.description ?? ""}`),
      ),
    }))
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, 5);
  const duplicateScore = rankedSuggestions[0]?.score ?? 0;

  return NextResponse.json(
    actionSuccess({
      topics: topics.map((topic, index) => ({
        id: topic.id,
        slug: topic.slug,
        name: topic.name,
        description: topic.description,
        followers: topic.followerCount,
        questions: topic.questionCount,
        accent: topic.color ?? topicAccents[index % topicAccents.length],
        icon: topic.name
          .split(/\s+/)
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      })),
      suggestions: rankedSuggestions,
      qualityWarnings: questionQualityWarnings({
        title: query,
        duplicateScore,
      }),
    }),
  );
}

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to ask a question."),
      { status: 401 },
    );

  const createLimit = await checkRateLimit(
    `question:${session.user.id}`,
    8,
    60 * 60_000,
  );
  if (!createLimit.allowed) return rateLimitResponse(createLimit);

  const parsed = questionSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError(
        "VALIDATION_ERROR",
        "Check your question.",
        parsed.error.flatten().fieldErrors,
      ),
      { status: 400 },
    );

  const abuse = assessUserText(
    `${parsed.data.title}\n${parsed.data.description}`,
    { maxLinks: 8 },
  );
  if (!abuse.ok)
    return NextResponse.json(actionError(abuse.code, abuse.message), {
      status: 400,
    });

  // catch exact and slug-equivalent duplicates before generating a fallback slug
  const normalized = parsed.data.title
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const baseSlug = slugify(parsed.data.title);
  const duplicateCandidates = await prisma.question.findMany({
    where: {
      deletedAt: null,
      mergedIntoId: null,
      OR: [
        { title: { equals: normalized, mode: "insensitive" } },
        { slug: baseSlug },
        ...tokenizeSearch(parsed.data.title)
          .slice(0, 6)
          .map((term) => ({
            title: { contains: term, mode: "insensitive" as const },
          })),
      ],
    },
    select: { slug: true, title: true, description: true },
    take: 12,
  });
  const duplicate = duplicateCandidates.find((candidate) => {
    if (candidate.slug === baseSlug) return true;
    if (
      candidate.title.toLowerCase().replace(/\s+/g, " ").trim() === normalized
    )
      return true;
    return similarityRatio(parsed.data.title, candidate.title) >= 0.86;
  });
  if (duplicate)
    return NextResponse.json(
      actionError(
        "DUPLICATE",
        `A matching question already exists: /question/${duplicate.slug}`,
      ),
      { status: 409 },
    );

  const existing = await prisma.question.findUnique({
    where: { slug: baseSlug },
    select: { id: true },
  });
  const slug = existing
    ? `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`
    : baseSlug;

  try {
    const question = await prisma.$transaction(async (tx) => {
      const validTopics = await tx.topic.findMany({
        where: { name: { in: parsed.data.topics }, deletedAt: null },
        select: { id: true },
      });
      if (validTopics.length !== parsed.data.topics.length)
        throw new Error("NO_TOPICS");

      await tx.topic.updateMany({
        where: { id: { in: validTopics.map((topic) => topic.id) } },
        data: { questionCount: { increment: 1 } },
      });

      const created = await tx.question.create({
        data: {
          title: parsed.data.title,
          description: parsed.data.description,
          slug,
          authorId: session.user.id,
          topics: {
            create: validTopics.map((topic) => ({ topicId: topic.id })),
          },
        },
        select: { id: true, slug: true, title: true },
      });
      await recordTopicAffinity(tx, {
        userId: session.user.id,
        topicIds: validTopics.map((topic) => topic.id),
        signal: "question",
      });
      const imageUrls = extractMarkdownImageUrls(parsed.data.description);
      if (imageUrls.length)
        await tx.mediaAttachment.updateMany({
          where: {
            userId: session.user.id,
            questionId: null,
            answerId: null,
            url: { in: imageUrls },
          },
          data: { questionId: created.id },
        });

      const mentionedUsernames = extractMentionedUsernames(
        `${parsed.data.title} ${parsed.data.description}`,
      );
      if (mentionedUsernames.length > 0) {
        const mentionedUsers = await tx.user.findMany({
          where: {
            username: { in: mentionedUsernames },
            id: { not: session.user.id },
            deletedAt: null,
            suspendedAt: null,
          },
          select: { id: true },
          take: 10,
        });
        const mentionRecipients = await filterNotificationRecipients(
          tx,
          mentionedUsers.map((user) => user.id),
          {
            actorId: session.user.id,
            topicIds: validTopics.map((topic) => topic.id),
          },
        );
        if (mentionRecipients.length > 0)
          await tx.notification.createMany({
            data: mentionRecipients.map((recipientId) => ({
              recipientId,
              actorId: session.user.id,
              questionId: created.id,
              type: "MENTION" as const,
              message: `${session.user.name ?? "Someone"} mentioned you in a question`,
            })),
          });
      }

      return created;
    });

    logger.info("question.created", {
      questionId: question.id,
      userId: session.user.id,
    });
    void trackAnalytics("question_created", {
      userId: session.user.id,
      request,
      properties: {
        questionId: question.id,
        topicCount: parsed.data.topics.length,
        hasDescription: Boolean(parsed.data.description),
      },
    });
    return NextResponse.json(actionSuccess(question), { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_TOPICS")
      return NextResponse.json(
        actionError("VALIDATION_ERROR", "Select only existing topics."),
        { status: 400 },
      );
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        actionError(
          "CONFLICT",
          "That question changed while it was being published. Please try again.",
        ),
        { status: 409 },
      );
    logger.error("question.create_failed", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      actionError("INTERNAL_ERROR", "We could not publish your question."),
      { status: 500 },
    );
  }
}
