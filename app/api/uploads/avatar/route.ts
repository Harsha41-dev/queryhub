import { NextResponse } from "next/server";
import { actionError, actionSuccess } from "@/lib/errors";
import { env } from "@/lib/env";
import { captureException } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getActiveSession } from "@/lib/session";
import { InvalidImageError, prepareAvatar } from "@/lib/storage/image";
import { deleteByUrl, putAvatar } from "@/lib/storage/provider";

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to upload an avatar."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `avatar:${session.user.id}`,
    10,
    60 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > env.MAX_UPLOAD_BYTES + 512 * 1024)
    return NextResponse.json(
      actionError("FILE_TOO_LARGE", "The avatar file is too large."),
      { status: 413 },
    );

  let uploaded: Awaited<ReturnType<typeof putAvatar>> | undefined;
  try {
    const form = await request.formData();
    const file = form.get("avatar");
    if (!(file instanceof File))
      return NextResponse.json(
        actionError("VALIDATION_ERROR", "Choose an avatar image."),
        { status: 400 },
      );

    const prepared = await prepareAvatar(
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
    uploaded = await putAvatar(prepared.data);

    const previous = await prisma.mediaAttachment.findFirst({
      where: {
        userId: session.user.id,
        questionId: null,
        answerId: null,
      },
      orderBy: { createdAt: "desc" },
    });

    const media = await prisma.$transaction(async (transaction) => {
      if (previous)
        await transaction.mediaAttachment.delete({
          where: { id: previous.id },
        });
      const created = await transaction.mediaAttachment.create({
        data: {
          userId: session.user.id,
          url: uploaded!.url,
          mimeType: prepared.mimeType,
          size: prepared.data.byteLength,
          width: prepared.width,
          height: prepared.height,
          alt: "Profile avatar",
        },
      });
      await transaction.user.update({
        where: { id: session.user.id },
        data: { image: uploaded!.url },
      });
      return created;
    });

    if (previous)
      void deleteByUrl(previous.url).catch((error) =>
        captureException(error, { operation: "storage.avatar_cleanup" }),
      );

    return NextResponse.json(
      actionSuccess({
        url: media.url,
        width: media.width,
        height: media.height,
      }),
      { status: 201 },
    );
  } catch (error) {
    if (uploaded) void deleteByUrl(uploaded.url).catch(() => undefined);

    if (error instanceof InvalidImageError)
      return NextResponse.json(actionError("INVALID_IMAGE", error.message), {
        status: 400,
      });

    await captureException(error, {
      operation: "storage.avatar_upload",
      requestId: request.headers.get("x-request-id") ?? undefined,
      userId: session.user.id,
    });
    return NextResponse.json(
      actionError("UPLOAD_FAILED", "The avatar could not be uploaded."),
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to remove an avatar."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `avatar:${session.user.id}`,
    10,
    60 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const previous = await prisma.mediaAttachment.findFirst({
    where: { userId: session.user.id, questionId: null, answerId: null },
    orderBy: { createdAt: "desc" },
  });

  await prisma.$transaction(async (transaction) => {
    await transaction.user.update({
      where: { id: session.user.id },
      data: { image: null },
    });
    if (previous)
      await transaction.mediaAttachment.delete({ where: { id: previous.id } });
  });

  if (previous)
    void deleteByUrl(previous.url).catch((error) =>
      captureException(error, {
        operation: "storage.avatar_delete",
        requestId: request.headers.get("x-request-id") ?? undefined,
      }),
    );

  return NextResponse.json(actionSuccess({ deleted: Boolean(previous) }));
}
