import { NextResponse } from "next/server";
import { z } from "zod";
import { getActiveSession } from "@/lib/session";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";

const schema = z
  .object({
    questionId: z.string().cuid().optional(),
    answerId: z.string().cuid().optional(),
  })
  .refine((value) => Boolean(value.questionId) !== Boolean(value.answerId));
export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to save posts."),
      { status: 401 },
    );
  const limit = await checkRateLimit(
    `bookmark:${session.user.id}`,
    60,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  const parsed = schema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose one item to bookmark."),
      { status: 400 },
    );
  const exists = parsed.data.questionId
    ? await prisma.question.findFirst({
        where: { id: parsed.data.questionId, deletedAt: null, isHidden: false },
        select: { id: true },
      })
    : await prisma.answer.findFirst({
        where: { id: parsed.data.answerId, deletedAt: null, isHidden: false },
        select: { id: true },
      });
  if (!exists)
    return NextResponse.json(
      actionError("NOT_FOUND", "That item is no longer available."),
      { status: 404 },
    );
  const existing = await prisma.bookmark.findFirst({
    where: { userId: session.user.id, ...parsed.data },
  });
  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    return NextResponse.json(actionSuccess({ bookmarked: false }));
  }
  await prisma.bookmark.create({
    data: { userId: session.user.id, ...parsed.data },
  });
  return NextResponse.json(actionSuccess({ bookmarked: true }), {
    status: 201,
  });
}
