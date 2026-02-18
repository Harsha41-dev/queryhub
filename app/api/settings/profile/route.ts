import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getActiveSession } from "@/lib/session";
import { actionError, actionSuccess } from "@/lib/errors";
import { captureException } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { parseJson } from "@/lib/request";
import { deleteByUrl } from "@/lib/storage/provider";
import { profileSchema } from "@/lib/validators";

export async function PUT(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to update your profile."),
      { status: 401 },
    );
  const limit = await checkRateLimit(
    `profile:${session.user.id}`,
    30,
    5 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);
  const parsed = profileSchema.safeParse(await parseJson(request));
  if (!parsed.success)
    return NextResponse.json(
      actionError(
        "VALIDATION_ERROR",
        "Check your profile details.",
        parsed.error.flatten().fieldErrors,
      ),
      { status: 400 },
    );
  try {
    const previousUpload = await prisma.mediaAttachment.findFirst({
      where: {
        userId: session.user.id,
        questionId: null,
        answerId: null,
      },
      orderBy: { createdAt: "desc" },
    });
    const replaceUpload =
      previousUpload && previousUpload.url !== parsed.data.image;
    const user = await prisma.$transaction(async (transaction) => {
      if (replaceUpload)
        await transaction.mediaAttachment.delete({
          where: { id: previousUpload.id },
        });
      return transaction.user.update({
        where: { id: session.user.id },
        data: parsed.data,
        select: {
          name: true,
          username: true,
          image: true,
          bio: true,
          location: true,
          occupation: true,
          website: true,
        },
      });
    });
    if (replaceUpload)
      void deleteByUrl(previousUpload.url).catch((error) =>
        captureException(error, {
          operation: "storage.profile_replacement_cleanup",
          requestId: request.headers.get("x-request-id") ?? undefined,
        }),
      );
    return NextResponse.json(actionSuccess(user));
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return NextResponse.json(
        actionError("USERNAME_TAKEN", "That username is already in use."),
        { status: 409 },
      );
    return NextResponse.json(
      actionError("INTERNAL_ERROR", "We couldn’t save your profile."),
      { status: 500 },
    );
  }
}
