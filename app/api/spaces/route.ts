import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { assessUserText } from "@/lib/abuse";
import { trackAnalytics } from "@/lib/analytics";
import { actionError, actionSuccess } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { getActiveSession } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { spaceSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to create a Space."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `space-create:${session.user.id}`,
    6,
    60 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = spaceSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError(
        "VALIDATION_ERROR",
        "Check your Space details.",
        parsed.error.flatten().fieldErrors,
      ),
      { status: 400 },
    );
  const abuse = assessUserText(
    `${parsed.data.name}\n${parsed.data.description}\n${parsed.data.rules}`,
    { maxLinks: 4 },
  );
  if (!abuse.ok)
    return NextResponse.json(actionError(abuse.code, abuse.message), {
      status: 400,
    });

  const baseSlug = slugify(parsed.data.name);
  const existing = await prisma.space.findUnique({
    where: { slug: baseSlug },
    select: { id: true },
  });
  const slug = existing
    ? `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`
    : baseSlug;

  try {
    const space = await prisma.$transaction(async (tx) => {
      const created = await tx.space.create({
        data: {
          name: parsed.data.name,
          slug,
          description: parsed.data.description,
          rules: parsed.data.rules,
          color: parsed.data.color,
          allowMemberSubmissions: parsed.data.allowMemberSubmissions,
          requireApproval: parsed.data.requireApproval,
          ownerId: session.user.id,
          followerCount: 1,
        },
        select: { id: true, slug: true, name: true },
      });
      await tx.spaceMember.create({
        data: {
          spaceId: created.id,
          userId: session.user.id,
          role: "OWNER",
        },
      });
      await tx.userBadge.upsert({
        where: {
          userId_type_label: {
            userId: session.user.id,
            type: "MODERATOR",
            label: "Space Founder",
          },
        },
        create: {
          userId: session.user.id,
          type: "MODERATOR",
          label: "Space Founder",
          description: "Created and moderates a QueryHub Space.",
        },
        update: {},
      });
      return created;
    });
    void trackAnalytics("space_created", {
      userId: session.user.id,
      request,
      properties: { spaceId: space.id },
    });
    return NextResponse.json(actionSuccess(space), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        actionError("CONFLICT", "A Space with that name already exists."),
        { status: 409 },
      );
    return NextResponse.json(
      actionError("INTERNAL_ERROR", "Space could not be created."),
      { status: 500 },
    );
  }
}
