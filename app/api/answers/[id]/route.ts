import { NextResponse } from "next/server";
import { assessUserText } from "@/lib/abuse";
import { getActiveSession } from "@/lib/session";
import { canEdit } from "@/lib/authorization";
import { extractMarkdownImageUrls } from "@/lib/content-images";
import { actionError, actionSuccess } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { answerUpdateSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to edit answers."),
      { status: 401 },
    );

  const editLimit = await checkRateLimit(
    `content-change:${session.user.id}`,
    60,
    5 * 60_000,
  );
  if (!editLimit.allowed) return rateLimitResponse(editLimit);

  const { id } = await params;
  const answer = await prisma.answer.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, authorId: true },
  });
  if (!answer)
    return NextResponse.json(actionError("NOT_FOUND", "Answer not found."), {
      status: 404,
    });
  if (!canEdit(answer.authorId, session.user.id))
    return NextResponse.json(
      actionError("FORBIDDEN", "You can edit only your own answer."),
      { status: 403 },
    );

  const parsed = answerUpdateSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError(
        "VALIDATION_ERROR",
        "Add more detail to your answer.",
        parsed.error.flatten().fieldErrors,
      ),
      { status: 400 },
    );
  const abuse = assessUserText(parsed.data.content, { maxLinks: 12 });
  if (!abuse.ok)
    return NextResponse.json(actionError(abuse.code, abuse.message), {
      status: 400,
    });

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.answer.update({
      where: { id },
      data: { content: parsed.data.content },
      select: { id: true, content: true, updatedAt: true },
    });
    const imageUrls = extractMarkdownImageUrls(parsed.data.content);
    if (imageUrls.length)
      await tx.mediaAttachment.updateMany({
        where: {
          userId: session.user.id,
          questionId: null,
          answerId: null,
          url: { in: imageUrls },
        },
        data: { answerId: result.id },
      });
    return result;
  });
  logger.info("answer.updated", { answerId: id, userId: session.user.id });
  return NextResponse.json(actionSuccess(updated));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to delete answers."),
      { status: 401 },
    );

  const deleteLimit = await checkRateLimit(
    `content-change:${session.user.id}`,
    60,
    5 * 60_000,
  );
  if (!deleteLimit.allowed) return rateLimitResponse(deleteLimit);

  const { id } = await params;
  const answer = await prisma.answer.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, authorId: true, questionId: true },
  });
  if (!answer)
    return NextResponse.json(actionError("NOT_FOUND", "Answer not found."), {
      status: 404,
    });
  if (!canEdit(answer.authorId, session.user.id))
    return NextResponse.json(
      actionError("FORBIDDEN", "You can delete only your own answer."),
      { status: 403 },
    );

  const deleted = await prisma.$transaction(async (tx) => {
    const result = await tx.answer.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return false;
    await tx.question.updateMany({
      where: { id: answer.questionId, answerCount: { gt: 0 } },
      data: { answerCount: { decrement: 1 } },
    });
    return true;
  });

  if (!deleted)
    return NextResponse.json(actionError("NOT_FOUND", "Answer not found."), {
      status: 404,
    });

  logger.info("answer.deleted", { answerId: id, userId: session.user.id });
  return NextResponse.json(actionSuccess({ deleted: true }));
}
