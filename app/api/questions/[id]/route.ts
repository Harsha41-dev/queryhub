import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assessUserText } from "@/lib/abuse";
import { getActiveSession } from "@/lib/session";
import { canEdit, canModerate } from "@/lib/authorization";
import { extractMarkdownImageUrls } from "@/lib/content-images";
import { actionError, actionSuccess } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { slugify } from "@/lib/utils";
import { questionUpdateSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to edit questions."),
      { status: 401 },
    );
  const editLimit = await checkRateLimit(
    `content-change:${session.user.id}`,
    60,
    5 * 60_000,
  );
  if (!editLimit.allowed) return rateLimitResponse(editLimit);
  const { id } = await params;
  const question = await prisma.question.findFirst({
    where: { id, deletedAt: null, mergedIntoId: null },
    select: { id: true, authorId: true, slug: true },
  });
  if (!question)
    return NextResponse.json(actionError("NOT_FOUND", "Question not found."), {
      status: 404,
    });
  if (
    !canEdit(question.authorId, session.user.id) &&
    !canModerate(session.user.role)
  )
    return NextResponse.json(
      actionError(
        "FORBIDDEN",
        "You can edit only your own question unless you are a moderator.",
      ),
      { status: 403 },
    );
  const parsed = questionUpdateSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError(
        "VALIDATION_ERROR",
        "Check the question fields.",
        parsed.error.flatten().fieldErrors,
      ),
      { status: 400 },
    );
  const abuse = assessUserText(
    `${parsed.data.title ?? ""}\n${parsed.data.description ?? ""}`,
    { maxLinks: 8 },
  );
  if (!abuse.ok)
    return NextResponse.json(actionError(abuse.code, abuse.message), {
      status: 400,
    });
  const { topics, ...fields } = parsed.data;
  if (fields.title) {
    const requestedSlug = slugify(fields.title);
    const duplicate = await prisma.question.findFirst({
      where: {
        id: { not: question.id },
        deletedAt: null,
        mergedIntoId: null,
        OR: [
          { title: { equals: fields.title, mode: "insensitive" } },
          { slug: requestedSlug },
        ],
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
  }
  const slug = fields.title
    ? await uniqueQuestionSlug(fields.title, question.id)
    : undefined;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (topics) {
        const [topicRecords, currentTopics] = await Promise.all([
          tx.topic.findMany({
            where: { name: { in: topics }, deletedAt: null },
            select: { id: true },
          }),
          tx.questionTopic.findMany({
            where: { questionId: question.id },
            select: { topicId: true },
          }),
        ]);
        if (topicRecords.length !== topics.length) throw new Error("NO_TOPICS");
        const currentIds = new Set(currentTopics.map((item) => item.topicId));
        const nextIds = new Set(topicRecords.map((item) => item.id));
        const removed = currentTopics
          .map((item) => item.topicId)
          .filter((topicId) => !nextIds.has(topicId));
        const added = topicRecords
          .map((item) => item.id)
          .filter((topicId) => !currentIds.has(topicId));
        if (removed.length) {
          await tx.questionTopic.deleteMany({
            where: { questionId: question.id, topicId: { in: removed } },
          });
          await tx.topic.updateMany({
            where: { id: { in: removed }, questionCount: { gt: 0 } },
            data: { questionCount: { decrement: 1 } },
          });
        }
        if (added.length) {
          await tx.questionTopic.createMany({
            data: added.map((topicId) => ({
              questionId: question.id,
              topicId,
            })),
          });
          await tx.topic.updateMany({
            where: { id: { in: added } },
            data: { questionCount: { increment: 1 } },
          });
        }
      }
      const updated = await tx.question.update({
        where: { id: question.id },
        data: { ...fields, ...(slug ? { slug } : {}) },
        select: { id: true, slug: true, title: true },
      });
      if (fields.description !== undefined) {
        const imageUrls = extractMarkdownImageUrls(fields.description);
        if (imageUrls.length)
          await tx.mediaAttachment.updateMany({
            where: {
              userId: session.user.id,
              questionId: null,
              answerId: null,
              url: { in: imageUrls },
            },
            data: { questionId: question.id },
          });
      }
      return updated;
    });
    logger.info("question.updated", {
      questionId: id,
      userId: session.user.id,
    });
    return NextResponse.json(actionSuccess(updated));
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
          "That question changed while it was being saved. Please try again.",
        ),
        { status: 409 },
      );
    logger.error("question.update_failed", {
      questionId: id,
      userId: session.user.id,
    });
    return NextResponse.json(
      actionError("INTERNAL_ERROR", "We could not update the question."),
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to delete questions."),
      { status: 401 },
    );
  const deleteLimit = await checkRateLimit(
    `content-change:${session.user.id}`,
    60,
    5 * 60_000,
  );
  if (!deleteLimit.allowed) return rateLimitResponse(deleteLimit);
  const { id } = await params;
  const question = await prisma.question.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, authorId: true, topics: { select: { topicId: true } } },
  });
  if (!question)
    return NextResponse.json(actionError("NOT_FOUND", "Question not found."), {
      status: 404,
    });
  if (!canEdit(question.authorId, session.user.id))
    return NextResponse.json(
      actionError("FORBIDDEN", "You can delete only your own question."),
      { status: 403 },
    );
  const deleted = await prisma.$transaction(async (tx) => {
    const result = await tx.question.updateMany({
      where: { id: question.id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return false;
    await tx.topic.updateMany({
      where: {
        id: { in: question.topics.map((topic) => topic.topicId) },
        questionCount: { gt: 0 },
      },
      data: { questionCount: { decrement: 1 } },
    });
    return true;
  });
  if (!deleted)
    return NextResponse.json(actionError("NOT_FOUND", "Question not found."), {
      status: 404,
    });
  logger.info("question.deleted", { questionId: id, userId: session.user.id });
  return NextResponse.json(actionSuccess({ deleted: true }));
}

async function uniqueQuestionSlug(title: string, questionId: string) {
  const base = slugify(title);
  const collision = await prisma.question.findFirst({
    where: { slug: base, id: { not: questionId } },
    select: { id: true },
  });
  return collision ? `${base}-${crypto.randomUUID().slice(0, 8)}` : base;
}
