import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { actionError, actionSuccess } from "@/lib/errors";
import { getActiveSession } from "@/lib/session";
import { logger } from "@/lib/logger";
import { extractMentionedUsernames } from "@/lib/mentions";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  clientRateLimitKey,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
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
  const terms = query
    .split(/\W+/)
    .filter((term) => term.length > 4)
    .slice(0, 5);
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
            OR: terms.map((term) => ({
              title: { contains: term, mode: "insensitive" },
            })),
          },
          select: { id: true, slug: true, title: true },
          orderBy: [{ score: "desc" }, { createdAt: "desc" }],
          take: 5,
        })
      : prisma.question.findMany({
          where: { id: "__never__" },
          select: { id: true, slug: true, title: true },
          take: 0,
        }),
  ]);
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
      suggestions,
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
  const normalized = parsed.data.title
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const duplicate = await prisma.question.findFirst({
    where: {
      title: { equals: normalized, mode: "insensitive" },
      deletedAt: null,
    },
    select: { slug: true },
  });
  if (duplicate)
    return NextResponse.json(
      actionError(
        "DUPLICATE",
        `A matching question already exists: /question/${duplicate.slug}`,
      ),
      { status: 409 },
    );
  const baseSlug = slugify(parsed.data.title);
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
        if (mentionedUsers.length > 0)
          await tx.notification.createMany({
            data: mentionedUsers.map((user) => ({
              recipientId: user.id,
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
      actionError("INTERNAL_ERROR", "We couldn’t publish your question."),
      { status: 500 },
    );
  }
}
