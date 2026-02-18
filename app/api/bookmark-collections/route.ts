import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { actionError, actionSuccess } from "@/lib/errors";
import { getBookmarkCollections } from "@/lib/query-data";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { getActiveSession } from "@/lib/session";
import { bookmarkCollectionSchema, bookmarkMoveSchema } from "@/lib/validators";

const deleteSchema = z.object({ id: z.string().cuid() });

export async function GET() {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to view collections."),
      { status: 401 },
    );
  return NextResponse.json(
    actionSuccess({
      collections: await getBookmarkCollections(session.user.id),
    }),
  );
}

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to create collections."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `bookmark-collections:${session.user.id}`,
    30,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = bookmarkCollectionSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Check the collection details."),
      { status: 400 },
    );

  try {
    const collection = parsed.data.id
      ? await prisma.bookmarkCollection.updateMany({
          where: { id: parsed.data.id, userId: session.user.id },
          data: {
            name: parsed.data.name,
            description: parsed.data.description || null,
          },
        })
      : await prisma.bookmarkCollection.create({
          data: {
            userId: session.user.id,
            name: parsed.data.name,
            description: parsed.data.description || null,
          },
          select: { id: true, name: true },
        });
    return NextResponse.json(actionSuccess(collection), { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        actionError("CONFLICT", "A collection with that name already exists."),
        { status: 409 },
      );
    return NextResponse.json(
      actionError("INTERNAL_ERROR", "Collection could not be saved."),
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to move bookmarks."),
      { status: 401 },
    );
  const limit = await checkRateLimit(
    `bookmark-collections:${session.user.id}`,
    60,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = bookmarkMoveSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a bookmark and collection."),
      { status: 400 },
    );

  if (parsed.data.collectionId) {
    const collection = await prisma.bookmarkCollection.findFirst({
      where: { id: parsed.data.collectionId, userId: session.user.id },
      select: { id: true },
    });
    if (!collection)
      return NextResponse.json(
        actionError("NOT_FOUND", "That collection was not found."),
        { status: 404 },
      );
  }

  const result = await prisma.bookmark.updateMany({
    where: { id: parsed.data.bookmarkId, userId: session.user.id },
    data: { collectionId: parsed.data.collectionId },
  });
  return NextResponse.json(actionSuccess({ updated: result.count }));
}

export async function DELETE(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to delete collections."),
      { status: 401 },
    );
  const limit = await checkRateLimit(
    `bookmark-collections:${session.user.id}`,
    60,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const parsed = deleteSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError("VALIDATION_ERROR", "Choose a collection."),
      { status: 400 },
    );

  await prisma.bookmark.updateMany({
    where: { collectionId: parsed.data.id, userId: session.user.id },
    data: { collectionId: null },
  });
  const result = await prisma.bookmarkCollection.deleteMany({
    where: { id: parsed.data.id, userId: session.user.id },
  });
  return NextResponse.json(actionSuccess({ deleted: result.count > 0 }));
}
