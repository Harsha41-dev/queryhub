import { NextResponse } from "next/server";
import { trackAnalytics } from "@/lib/analytics";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getActiveSession } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to join Spaces."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `space-join:${session.user.id}`,
    40,
    60 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const { id } = await params;
  const space = await prisma.space.findFirst({
    where: { id, deletedAt: null },
    select: { id: true, ownerId: true },
  });
  if (!space)
    return NextResponse.json(actionError("NOT_FOUND", "Space not found."), {
      status: 404,
    });

  const key = {
    spaceId_userId: { spaceId: space.id, userId: session.user.id },
  };
  const existing = await prisma.spaceMember.findUnique({ where: key });
  if (existing?.role === "OWNER")
    return NextResponse.json(actionSuccess({ joined: true }));

  await prisma.$transaction([
    existing
      ? prisma.spaceMember.delete({ where: key })
      : prisma.spaceMember.create({
          data: { spaceId: space.id, userId: session.user.id },
        }),
    existing
      ? prisma.space.updateMany({
          where: { id: space.id, followerCount: { gt: 0 } },
          data: { followerCount: { decrement: 1 } },
        })
      : prisma.space.update({
          where: { id: space.id },
          data: { followerCount: { increment: 1 } },
        }),
  ]);

  void trackAnalytics("space_membership_toggled", {
    userId: session.user.id,
    request,
    properties: { spaceId: space.id, joined: !existing },
  });
  return NextResponse.json(actionSuccess({ joined: !existing }));
}
