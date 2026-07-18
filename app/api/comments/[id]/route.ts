import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/session";
import { canEdit } from "@/lib/authorization";
import { actionError, actionSuccess } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { commentUpdateSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to edit comments."),
      { status: 401 },
    );
  const editLimit = await checkRateLimit(
    `content-change:${session.user.id}`,
    60,
    5 * 60_000,
  );
  if (!editLimit.allowed) return rateLimitResponse(editLimit);
  const { id } = await params;
  const comment = await prisma.comment.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, authorId: true },
  });
  if (!comment)
    return NextResponse.json(actionError("NOT_FOUND", "Comment not found."), {
      status: 404,
    });
  if (!canEdit(comment.authorId, session.user.id))
    return NextResponse.json(
      actionError("FORBIDDEN", "You can edit only your own comment."),
      { status: 403 },
    );
  const parsed = commentUpdateSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Check your comment."),
      { status: 400 },
    );
  const updated = await prisma.comment.update({
    where: { id },
    data: { content: parsed.data.content },
    select: { id: true, content: true, updatedAt: true },
  });
  logger.info("comment.updated", { commentId: id, userId: session.user.id });
  return NextResponse.json(actionSuccess(updated));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to delete comments."),
      { status: 401 },
    );
  const deleteLimit = await checkRateLimit(
    `content-change:${session.user.id}`,
    60,
    5 * 60_000,
  );
  if (!deleteLimit.allowed) return rateLimitResponse(deleteLimit);
  const { id } = await params;
  const comment = await prisma.comment.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, authorId: true, answerId: true },
  });
  if (!comment)
    return NextResponse.json(actionError("NOT_FOUND", "Comment not found."), {
      status: 404,
    });
  if (!canEdit(comment.authorId, session.user.id))
    return NextResponse.json(
      actionError("FORBIDDEN", "You can delete only your own comment."),
      { status: 403 },
    );
  const deletedCount = await prisma.$transaction(async (tx) => {
    const subtree = [comment.id];
    let parents = [comment.id];
    while (parents.length) {
      const children = await tx.comment.findMany({
        where: { parentId: { in: parents }, deletedAt: null },
        select: { id: true },
      });
      parents = children.map((child) => child.id);
      subtree.push(...parents);
    }
    const deleted = await tx.comment.updateMany({
      where: { id: { in: subtree }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (deleted.count > 0)
      await tx.answer.update({
        where: { id: comment.answerId },
        data: { commentCount: { decrement: deleted.count } },
      });
    return deleted.count;
  });
  if (deletedCount === 0)
    return NextResponse.json(actionError("NOT_FOUND", "Comment not found."), {
      status: 404,
    });
  logger.info("comment.deleted", {
    commentId: id,
    userId: session.user.id,
    deletedCount,
  });
  return NextResponse.json(actionSuccess({ deleted: true, deletedCount }));
}
