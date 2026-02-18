import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assessUserText } from "@/lib/abuse";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { getActiveSession } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { spaceMemberSchema, spaceUpdateSchema } from "@/lib/validators";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to manage this Space."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `space-settings:${session.user.id}`,
    60,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const { id } = await params;
  const payload = await parseJson(request);
  const settings = spaceUpdateSchema.safeParse(payload);
  const member = spaceMemberSchema.safeParse(payload);
  if (!settings.success && !member.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Check the Space settings."),
      { status: 400 },
    );

  const space = await prisma.space.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, ownerId: true, slug: true, name: true },
  });
  if (!space)
    return NextResponse.json(actionError("NOT_FOUND", "Space not found."), {
      status: 404,
    });
  if (space.ownerId !== session.user.id)
    return NextResponse.json(
      actionError(
        "FORBIDDEN",
        "Only the Space owner can change these settings.",
      ),
      { status: 403 },
    );

  if (settings.success) {
    const abuse = assessUserText(
      `${settings.data.name}\n${settings.data.description}\n${settings.data.rules}`,
      { maxLinks: 6 },
    );
    if (!abuse.ok)
      return NextResponse.json(actionError(abuse.code, abuse.message), {
        status: 400,
      });

    const nextSlug =
      settings.data.name === space.name
        ? space.slug
        : slugify(settings.data.name);
    const duplicate = await prisma.space.findFirst({
      where: { id: { not: space.id }, slug: nextSlug },
      select: { id: true },
    });
    if (duplicate)
      return NextResponse.json(
        actionError("CONFLICT", "Another Space already uses that name."),
        { status: 409 },
      );

    try {
      const updated = await prisma.space.update({
        where: { id: space.id },
        data: {
          name: settings.data.name,
          slug: nextSlug,
          description: settings.data.description,
          rules: settings.data.rules,
          color: settings.data.color,
          allowMemberSubmissions: settings.data.allowMemberSubmissions,
          requireApproval: settings.data.requireApproval,
        },
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          rules: true,
          color: true,
          allowMemberSubmissions: true,
          requireApproval: true,
          followerCount: true,
          questionCount: true,
        },
      });
      return NextResponse.json(
        actionSuccess({
          id: updated.id,
          slug: updated.slug,
          name: updated.name,
          description: updated.description,
          rules: updated.rules,
          color: updated.color,
          allowMemberSubmissions: updated.allowMemberSubmissions,
          requireApproval: updated.requireApproval,
          followers: updated.followerCount,
          questions: updated.questionCount,
          joined: true,
          role: "OWNER",
        }),
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        return NextResponse.json(
          actionError("CONFLICT", "Another Space already uses that name."),
          { status: 409 },
        );
      throw error;
    }
  }
  if (!member.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Check the Space member action."),
      { status: 400 },
    );
  const memberAction = member.data;

  const existingMember = await prisma.spaceMember.findUnique({
    where: {
      spaceId_userId: {
        spaceId: space.id,
        userId: memberAction.userId,
      },
    },
    select: { userId: true, role: true },
  });
  if (!existingMember)
    return NextResponse.json(actionError("NOT_FOUND", "Member not found."), {
      status: 404,
    });
  if (existingMember.role === "OWNER")
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "The owner role cannot be changed here."),
      { status: 400 },
    );

  if (memberAction.action === "REMOVE_MEMBER") {
    await prisma.$transaction([
      prisma.spaceMember.delete({
        where: {
          spaceId_userId: { spaceId: space.id, userId: memberAction.userId },
        },
      }),
      prisma.space.updateMany({
        where: { id: space.id, followerCount: { gt: 0 } },
        data: { followerCount: { decrement: 1 } },
      }),
    ]);
    return NextResponse.json(
      actionSuccess({ userId: memberAction.userId, removed: true }),
    );
  }

  const updated = await prisma.spaceMember.update({
    where: {
      spaceId_userId: { spaceId: space.id, userId: memberAction.userId },
    },
    data: { role: memberAction.role },
    select: { userId: true, role: true },
  });
  return NextResponse.json(actionSuccess(updated));
}
