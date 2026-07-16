import { NextResponse } from "next/server";
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
  const target = parsed.data.questionId
    ? await prisma.question.findFirst({
        where: { id: parsed.data.questionId, deletedAt: null },
        select: { id: true },
      })
    : parsed.data.answerId
      ? await prisma.answer.findFirst({
          where: { id: parsed.data.answerId, deletedAt: null },
          select: { id: true },
        })
      : parsed.data.commentId
        ? await prisma.comment.findFirst({
            where: { id: parsed.data.commentId, deletedAt: null },
            select: { id: true },
          })
        : await prisma.user.findFirst({
            where: { id: parsed.data.profileId, deletedAt: null },
            select: { id: true },
          });
  if (!target)
    return NextResponse.json(
      actionError("NOT_FOUND", "That item is no longer available."),
      { status: 404 },
    );
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
  const report = await prisma.report.create({
    data: { reporterId: session.user.id, ...parsed.data },
    select: { id: true, status: true },
  });
  return NextResponse.json(actionSuccess(report), { status: 201 });
}
