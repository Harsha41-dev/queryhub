import { NextResponse } from "next/server";
import { actionError, actionSuccess } from "@/lib/errors";
import { env } from "@/lib/env";
import { captureException } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { getActiveSession } from "@/lib/session";
import { InvalidImageError, prepareContentImage } from "@/lib/storage/image";
import { deleteByUrl, putContentImage } from "@/lib/storage/provider";

export async function POST(request: Request) {
  const session = await getActiveSession();
  if (!session?.user)
    return NextResponse.json(
      actionError("UNAUTHORIZED", "Sign in to upload an image."),
      { status: 401 },
    );

  const limit = await checkRateLimit(
    `content-image:${session.user.id}`,
    20,
    60 * 60_000,
  );
  if (!limit.allowed) return rateLimitResponse(limit);

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > env.MAX_UPLOAD_BYTES + 512 * 1024)
    return NextResponse.json(
      actionError("FILE_TOO_LARGE", "The image file is too large."),
      { status: 413 },
    );

  let uploaded: Awaited<ReturnType<typeof putContentImage>> | undefined;
  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File))
      return NextResponse.json(
        actionError("VALIDATION_ERROR", "Choose an image."),
        { status: 400 },
      );
    const requestedAlt =
      typeof form.get("alt") === "string"
        ? String(form.get("alt"))
            .replace(/[\[\]()`]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80)
        : "";
    const caption =
      typeof form.get("caption") === "string"
        ? String(form.get("caption"))
            .replace(/[\[\]()`]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 160)
        : "";

    const prepared = await prepareContentImage(
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
    uploaded = await putContentImage(prepared.data);
    const fallbackAlt =
      file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[\[\]()`]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || "Uploaded image";
    const alt = requestedAlt || fallbackAlt;
    const media = await prisma.mediaAttachment.create({
      data: {
        userId: session.user.id,
        url: uploaded.url,
        mimeType: prepared.mimeType,
        size: prepared.data.byteLength,
        width: prepared.width,
        height: prepared.height,
        alt,
      },
    });

    return NextResponse.json(
      actionSuccess({
        id: media.id,
        url: media.url,
        alt: media.alt,
        width: media.width,
        height: media.height,
        caption,
        markdown: caption
          ? `![${media.alt}](${media.url})\n*${caption}*`
          : `![${media.alt}](${media.url})`,
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
      operation: "storage.content_image_upload",
      requestId: request.headers.get("x-request-id") ?? undefined,
      userId: session.user.id,
    });
    return NextResponse.json(
      actionError("UPLOAD_FAILED", "The image could not be uploaded."),
      { status: 500 },
    );
  }
}
