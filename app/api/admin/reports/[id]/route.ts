import { NextResponse } from "next/server";
import { getActiveSession } from "@/lib/session";
import { canActOnRole, canModerate } from "@/lib/authorization";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { adminReportSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  const parsed = adminReportSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a valid moderation action."),
      { status: 400 },
    );
  const { id } = await params;
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report)
    return NextResponse.json(actionError("NOT_FOUND", "Report not found."), {
      status: 404,
    });
  const userAction = ["SUSPEND_USER", "UNSUSPEND_USER"].includes(
    parsed.data.action,
  );
  const contentAction = ["HIDE_CONTENT", "RESTORE_CONTENT"].includes(
    parsed.data.action,
  );
  if (
    (userAction && !report.profileId) ||
    (contentAction && report.profileId)
  ) {
    return NextResponse.json(
      actionError(
        "VALIDATION_ERROR",
        "That action does not match the reported target.",
      ),
      { status: 400 },
    );
  }
  if (userAction && report.profileId) {
    const target = await prisma.user.findUnique({
      where: { id: report.profileId },
      select: { role: true },
    });
    if (!target || !canActOnRole(session.user.role, target.role))
      return NextResponse.json(
        actionError(
          "FORBIDDEN",
          "You cannot moderate an equal or higher role.",
        ),
        { status: 403 },
      );
  }
  let recipientId: string | null | undefined = report.profileId;
  let targetRole: "USER" | "MODERATOR" | "ADMIN" | undefined;
  if (!recipientId && report.questionId) {
    const target = await prisma.question.findUnique({
      where: { id: report.questionId },
      select: { authorId: true, author: { select: { role: true } } },
    });
    recipientId = target?.authorId;
    targetRole = target?.author.role;
  }
  if (!recipientId && report.answerId) {
    const target = await prisma.answer.findUnique({
      where: { id: report.answerId },
      select: { authorId: true, author: { select: { role: true } } },
    });
    recipientId = target?.authorId;
    targetRole = target?.author.role;
  }
  if (!recipientId && report.commentId) {
    const target = await prisma.comment.findUnique({
      where: { id: report.commentId },
      select: { authorId: true, author: { select: { role: true } } },
    });
    recipientId = target?.authorId;
    targetRole = target?.author.role;
  }
  if (contentAction && !recipientId)
    return NextResponse.json(
      actionError("NOT_FOUND", "The reported content no longer exists."),
      { status: 404 },
    );
  if (
    contentAction &&
    targetRole &&
    !canActOnRole(session.user.role, targetRole)
  )
    return NextResponse.json(
      actionError(
        "FORBIDDEN",
        "You cannot moderate content owned by an equal or higher role.",
      ),
      { status: 403 },
    );
  const result = await prisma.$transaction(async (tx) => {
    if (parsed.data.action === "HIDE_CONTENT") {
      if (report.questionId)
        await tx.question.update({
          where: { id: report.questionId },
          data: { isHidden: true },
        });
      if (report.answerId)
        await tx.answer.update({
          where: { id: report.answerId },
          data: { isHidden: true },
        });
      if (report.commentId)
        await tx.comment.update({
          where: { id: report.commentId },
          data: { isHidden: true },
        });
    }
    if (parsed.data.action === "RESTORE_CONTENT") {
      if (report.questionId)
        await tx.question.update({
          where: { id: report.questionId },
          data: { isHidden: false },
        });
      if (report.answerId)
        await tx.answer.update({
          where: { id: report.answerId },
          data: { isHidden: false },
        });
      if (report.commentId)
        await tx.comment.update({
          where: { id: report.commentId },
          data: { isHidden: false },
        });
    }
    if (parsed.data.action === "SUSPEND_USER") {
      if (!report.profileId) throw new Error("INVALID_PROFILE_ACTION");
      await tx.user.update({
        where: { id: report.profileId },
        data: {
          suspendedAt: new Date(),
          sessionVersion: { increment: 1 },
        },
      });
    }
    if (parsed.data.action === "UNSUSPEND_USER") {
      if (!report.profileId) throw new Error("INVALID_PROFILE_ACTION");
      await tx.user.update({
        where: { id: report.profileId },
        data: { suspendedAt: null, sessionVersion: { increment: 1 } },
      });
    }
    const updated = await tx.report.update({
      where: { id },
      data: {
        status:
          parsed.data.action === "DISMISS_REPORT"
            ? "DISMISSED"
            : parsed.data.action === "ADD_NOTE"
              ? report.status
              : "ACTIONED",
        moderatorNote: parsed.data.note,
        resolvedAt:
          parsed.data.action === "ADD_NOTE" ? report.resolvedAt : new Date(),
      },
    });
    await tx.moderationAction.create({
      data: {
        moderatorId: session.user.id,
        reportId: id,
        userId: report.profileId,
        questionId: report.questionId,
        answerId: report.answerId,
        commentId: report.commentId,
        action: parsed.data.action,
        note: parsed.data.note,
      },
    });
    if (
      parsed.data.action !== "ADD_NOTE" &&
      recipientId &&
      recipientId !== session.user.id
    )
      await tx.notification.create({
        data: {
          recipientId,
          actorId: session.user.id,
          questionId: report.questionId,
          answerId: report.answerId,
          commentId: report.commentId,
          type: "MODERATION",
          message:
            parsed.data.action === "DISMISS_REPORT"
              ? "A report concerning your content was reviewed and dismissed"
              : "Moderation reviewed a report concerning your account or content",
        },
      });
    return updated;
  });
  return NextResponse.json(
    actionSuccess({ id: result.id, status: reportStatusLabel(result.status) }),
  );
}

function reportStatusLabel(
  status: "PENDING" | "REVIEWING" | "DISMISSED" | "ACTIONED",
) {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "REVIEWING":
      return "Reviewing";
    case "DISMISSED":
      return "Dismissed";
    case "ACTIONED":
      return "Actioned";
  }
}
