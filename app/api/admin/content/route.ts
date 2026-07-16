import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getActiveSession } from "@/lib/session";
import { canActOnRole, canModerate, hasRole } from "@/lib/authorization";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { adminContentSchema } from "@/lib/validators";

export async function PATCH(request: Request) {
  const session = await getActiveSession();
  if (!session?.user || !canModerate(session.user.role))
    return NextResponse.json(
      actionError("FORBIDDEN", "Moderator access is required."),
      { status: 403 },
    );
  const limit = await checkRateLimit(
    `moderation:${session.user.id}`,
    120,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  const parsed = adminContentSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a valid content action."),
      { status: 400 },
    );
  if (parsed.data.target === "topic" && !hasRole(session.user.role, "ADMIN"))
    return NextResponse.json(
      actionError("FORBIDDEN", "Administrator access is required for topics."),
      { status: 403 },
    );
  const hidden = parsed.data.action === "HIDE_CONTENT";
  try {
    const result = await prisma.$transaction(async (tx) => {
      if (parsed.data.target === "question") {
        const item = await tx.question.update({
          where: { id: parsed.data.id },
          data: { isHidden: hidden },
          select: {
            id: true,
            isHidden: true,
            authorId: true,
            author: { select: { role: true } },
          },
        });
        if (!canActOnRole(session.user.role, item.author.role))
          throw new Error("ROLE_FORBIDDEN");
        await tx.moderationAction.create({
          data: {
            moderatorId: session.user.id,
            questionId: item.id,
            action: parsed.data.action,
            note: parsed.data.note,
          },
        });
        if (item.authorId !== session.user.id)
          await tx.notification.create({
            data: {
              recipientId: item.authorId,
              actorId: session.user.id,
              questionId: item.id,
              type: "MODERATION",
              message: `Your question was ${hidden ? "hidden" : "restored"} by moderation`,
            },
          });
        return {
          id: item.id,
          status: item.isHidden ? "Hidden" : "Published",
        };
      }
      if (parsed.data.target === "answer") {
        const item = await tx.answer.update({
          where: { id: parsed.data.id },
          data: { isHidden: hidden },
          select: {
            id: true,
            isHidden: true,
            authorId: true,
            author: { select: { role: true } },
          },
        });
        if (!canActOnRole(session.user.role, item.author.role))
          throw new Error("ROLE_FORBIDDEN");
        await tx.moderationAction.create({
          data: {
            moderatorId: session.user.id,
            answerId: item.id,
            action: parsed.data.action,
            note: parsed.data.note,
          },
        });
        if (item.authorId !== session.user.id)
          await tx.notification.create({
            data: {
              recipientId: item.authorId,
              actorId: session.user.id,
              answerId: item.id,
              type: "MODERATION",
              message: `Your answer was ${hidden ? "hidden" : "restored"} by moderation`,
            },
          });
        return {
          id: item.id,
          status: item.isHidden ? "Hidden" : "Published",
        };
      }
      if (parsed.data.target === "topic") {
        const item = await tx.topic.update({
          where: { id: parsed.data.id },
          data: { deletedAt: hidden ? new Date() : null },
          select: { id: true, deletedAt: true },
        });
        await tx.moderationAction.create({
          data: {
            moderatorId: session.user.id,
            topicId: item.id,
            action: parsed.data.action,
            note: parsed.data.note,
          },
        });
        return { id: item.id, status: item.deletedAt ? "Hidden" : "Active" };
      }
      const item = await tx.comment.update({
        where: { id: parsed.data.id },
        data: { isHidden: hidden },
        select: {
          id: true,
          isHidden: true,
          authorId: true,
          author: { select: { role: true } },
        },
      });
      if (!canActOnRole(session.user.role, item.author.role))
        throw new Error("ROLE_FORBIDDEN");
      await tx.moderationAction.create({
        data: {
          moderatorId: session.user.id,
          commentId: item.id,
          action: parsed.data.action,
          note: parsed.data.note,
        },
      });
      if (item.authorId !== session.user.id)
        await tx.notification.create({
          data: {
            recipientId: item.authorId,
            actorId: session.user.id,
            commentId: item.id,
            type: "MODERATION",
            message: `Your comment was ${hidden ? "hidden" : "restored"} by moderation`,
          },
        });
      return { id: item.id, status: item.isHidden ? "Hidden" : "Published" };
    });
    return NextResponse.json(actionSuccess(result));
  } catch (error) {
    if (error instanceof Error && error.message === "ROLE_FORBIDDEN")
      return NextResponse.json(
        actionError(
          "FORBIDDEN",
          "You cannot moderate content owned by an equal or higher role.",
        ),
        { status: 403 },
      );
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    )
      return NextResponse.json(
        actionError("NOT_FOUND", "That content no longer exists."),
        { status: 404 },
      );
    throw error;
  }
}
