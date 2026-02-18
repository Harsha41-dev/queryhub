// user reports spam / abuse on a post or profile

import { NextResponse } from "next/server";
import { assessContentRisk, assessUserText } from "@/lib/abuse";
import { getActiveSession } from "@/lib/session";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { reportSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to report content."),
      { status: 401 },
    );
  const limit = await checkRateLimit(
    `report:${session.user.id}`,
    10,
    60 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  const parsed = reportSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Check your report."),
      { status: 400 },
    );
  if (parsed.data.details) {
    const abuse = assessUserText(parsed.data.details, { maxLinks: 4 });
    if (!abuse.ok)
      return NextResponse.json(actionError(abuse.code, abuse.message), {
        status: 400,
      });
  }
  const target = parsed.data.questionId
    ? await prisma.question.findFirst({
        where: { id: parsed.data.questionId, deletedAt: null, isHidden: false },
        select: { id: true, authorId: true, title: true, description: true },
      })
    : parsed.data.answerId
      ? await prisma.answer.findFirst({
          where: {
            id: parsed.data.answerId,
            deletedAt: null,
            isHidden: false,
            question: { deletedAt: null, isHidden: false },
          },
          select: { id: true, authorId: true, content: true },
        })
      : parsed.data.commentId
        ? await prisma.comment.findFirst({
            where: {
              id: parsed.data.commentId,
              deletedAt: null,
              isHidden: false,
              answer: {
                deletedAt: null,
                isHidden: false,
                question: { deletedAt: null, isHidden: false },
              },
            },
            select: { id: true, authorId: true, content: true },
          })
        : await prisma.user.findFirst({
            where: {
              id: parsed.data.profileId,
              deletedAt: null,
              suspendedAt: null,
            },
            select: {
              id: true,
              name: true,
              username: true,
              bio: true,
              occupation: true,
            },
          });
  if (!target)
    return NextResponse.json(
      actionError("NOT_FOUND", "That item is no longer available."),
      { status: 404 },
    );
  const targetOwnerId = "authorId" in target ? target.authorId : target.id;
  if (targetOwnerId === session.user.id)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "You cannot report your own content."),
      { status: 400 },
    );
  const targetText =
    "title" in target
      ? `${target.title}\n${target.description ?? ""}`
      : "content" in target
        ? target.content
        : `${target.name} @${target.username}\n${target.bio ?? ""}\n${
            target.occupation ?? ""
          }`;
  const risk = assessContentRisk(targetText);
  const details =
    [
      parsed.data.details,
      risk.summary ? `Automated signals: ${risk.summary}` : undefined,
    ]
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 2000) || undefined;
  const reportTarget = parsed.data.questionId
    ? { questionId: parsed.data.questionId }
    : parsed.data.answerId
      ? { answerId: parsed.data.answerId }
      : parsed.data.commentId
        ? { commentId: parsed.data.commentId }
        : { profileId: parsed.data.profileId };
  const duplicate = await prisma.report.findFirst({
    where: {
      reporterId: session.user.id,
      status: { in: ["PENDING", "REVIEWING"] },
      ...reportTarget,
    },
    select: { id: true, status: true },
  });
  if (duplicate)
    return NextResponse.json(actionSuccess(duplicate), { status: 200 });
  const existingOpenCount = await prisma.report.count({
    where: {
      status: { in: ["PENDING", "REVIEWING"] },
      ...reportTarget,
    },
  });
  const status =
    existingOpenCount >= 2 || risk.score >= 4 ? "REVIEWING" : "PENDING";
  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.report.create({
      data: { reporterId: session.user.id, status, ...parsed.data, details },
      select: { id: true, status: true },
    });
    if (status === "REVIEWING") {
      const moderators = await tx.user.findMany({
        where: {
          role: { in: ["ADMIN", "MODERATOR"] },
          deletedAt: null,
          suspendedAt: null,
        },
        select: { id: true },
        take: 20,
      });
      if (moderators.length) {
        const notifications = moderators
          .filter((moderator) => moderator.id !== session.user.id)
          .map((moderator) => ({
            recipientId: moderator.id,
            actorId: session.user.id,
            questionId: parsed.data.questionId,
            answerId: parsed.data.answerId,
            commentId: parsed.data.commentId,
            type: "MODERATION" as const,
            message:
              risk.score >= 4
                ? "Automated moderation signals need review"
                : "Repeated reports need moderation review",
          }));
        if (notifications.length)
          await tx.notification.createMany({ data: notifications });
      }
    }
    return created;
  });
  return NextResponse.json(actionSuccess(report), { status: 201 });
}
