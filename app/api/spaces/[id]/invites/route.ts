import { NextResponse } from "next/server";
import { assessUserText } from "@/lib/abuse";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { getActiveSession } from "@/lib/session";
import { spaceInviteSchema } from "@/lib/validators";

function canInvite(role?: string) {
  return role === "OWNER" || role === "MODERATOR";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to invite members."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `space-invite:${session.user.id}`,
    30,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const payload = spaceInviteSchema.safeParse(await parseJson(request));
  if (!payload.success || payload.data.action !== "INVITE")
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Check the invite details."),
      { status: 400 },
    );
  const inviteData = payload.data;

  const { id } = await params;
  const [space, membership, invitee] = await Promise.all([
    prisma.space.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, slug: true, ownerId: true },
    }),
    prisma.spaceMember.findUnique({
      where: { spaceId_userId: { spaceId: id, userId: session.user.id } },
      select: { role: true },
    }),
    prisma.user.findFirst({
      where: {
        username: inviteData.username,
        deletedAt: null,
        suspendedAt: null,
      },
      select: { id: true, username: true },
    }),
  ]);
  if (!space)
    return NextResponse.json(actionError("NOT_FOUND", "Space not found."), {
      status: 404,
    });
  const actorRole =
    space.ownerId === session.user.id ? "OWNER" : membership?.role;
  if (!canInvite(actorRole))
    return NextResponse.json(
      actionError("FORBIDDEN", "Only Space owners and moderators can invite."),
      { status: 403 },
    );
  if (inviteData.role === "MODERATOR" && actorRole !== "OWNER")
    return NextResponse.json(
      actionError("FORBIDDEN", "Only the Space owner can invite moderators."),
      { status: 403 },
    );
  if (!invitee)
    return NextResponse.json(actionError("NOT_FOUND", "User not found."), {
      status: 404,
    });
  if (invitee.id === session.user.id)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "You cannot invite yourself."),
      { status: 400 },
    );
  const abuse = assessUserText(inviteData.message, { maxLinks: 2 });
  if (!abuse.ok)
    return NextResponse.json(actionError(abuse.code, abuse.message), {
      status: 400,
    });

  const existingMember = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId: space.id, userId: invitee.id } },
    select: { userId: true },
  });
  if (existingMember)
    return NextResponse.json(
      actionError("CONFLICT", "That user is already a Space member."),
      { status: 409 },
    );

  const invite = await prisma.$transaction(async (tx) => {
    const created = await tx.spaceInvite.upsert({
      where: {
        spaceId_inviteeId: { spaceId: space.id, inviteeId: invitee.id },
      },
      create: {
        spaceId: space.id,
        inviterId: session.user.id,
        inviteeId: invitee.id,
        role: inviteData.role,
        message: inviteData.message || null,
      },
      update: {
        inviterId: session.user.id,
        role: inviteData.role,
        message: inviteData.message || null,
        status: "PENDING",
        respondedAt: null,
      },
      select: { id: true, role: true, status: true },
    });
    await tx.notification.create({
      data: {
        recipientId: invitee.id,
        actorId: session.user.id,
        type: "SPACE_POST",
        message: `${session.user.name ?? "Someone"} invited you to join ${space.name}`,
      },
    });
    return created;
  });

  return NextResponse.json(actionSuccess(invite), { status: 201 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to respond to Space invites."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `space-invite-response:${session.user.id}`,
    60,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const payload = spaceInviteSchema.safeParse(await parseJson(request));
  if (!payload.success || payload.data.action !== "RESPOND")
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose an invite response."),
      { status: 400 },
    );

  const { id } = await params;
  const invite = await prisma.spaceInvite.findFirst({
    where: {
      id: payload.data.inviteId,
      spaceId: id,
      inviteeId: session.user.id,
      status: "PENDING",
      space: { deletedAt: null },
    },
    include: { space: { select: { id: true, slug: true } } },
  });
  if (!invite)
    return NextResponse.json(actionError("NOT_FOUND", "Invite not found."), {
      status: 404,
    });

  if (payload.data.response === "DECLINE") {
    const declined = await prisma.spaceInvite.update({
      where: { id: invite.id },
      data: { status: "DECLINED", respondedAt: new Date() },
      select: { id: true, status: true },
    });
    return NextResponse.json(actionSuccess(declined));
  }

  const accepted = await prisma.$transaction(async (tx) => {
    const existingMember = await tx.spaceMember.findUnique({
      where: {
        spaceId_userId: {
          spaceId: invite.spaceId,
          userId: session.user.id,
        },
      },
      select: { role: true },
    });
    if (!existingMember) {
      await tx.spaceMember.create({
        data: {
          spaceId: invite.spaceId,
          userId: session.user.id,
          role: invite.role,
        },
      });
      await tx.space.update({
        where: { id: invite.spaceId },
        data: { followerCount: { increment: 1 } },
      });
    }
    const updated = await tx.spaceInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", respondedAt: new Date() },
      select: { id: true, status: true, role: true },
    });
    return {
      ...updated,
      joined: true,
      spaceSlug: invite.space.slug,
    };
  });

  return NextResponse.json(actionSuccess(accepted));
}
