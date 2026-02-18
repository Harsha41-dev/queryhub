import "server-only";

import sharp from "sharp";
import { env } from "@/lib/env";

const acceptedFormats = new Set(["jpeg", "png", "webp"]);

export class InvalidImageError extends Error {
  constructor(message = "Upload a valid JPG, PNG, or WebP image.") {
    super(message);
    this.name = "InvalidImageError";
  }
}

// resize + convert avatar to webp (also drops extra metadata)
export async function prepareAvatar(input: Buffer, declaredMimeType: string) {
  if (input.byteLength === 0 || input.byteLength > env.MAX_UPLOAD_BYTES)
    throw new InvalidImageError(
      `Avatar images must be smaller than ${Math.floor(env.MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
    );

  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(declaredMimeType))
    throw new InvalidImageError();

  try {
    const pipeline = sharp(input, {
      failOn: "error",
      limitInputPixels: 40_000_000,
      animated: false,
    });
    const metadata = await pipeline.metadata();
    if (!metadata.format || !acceptedFormats.has(metadata.format))
      throw new InvalidImageError();

    const data = await pipeline
      .rotate()
      .resize(512, 512, { fit: "cover", position: "attention" })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();

    return { data, mimeType: "image/webp", width: 512, height: 512 } as const;
  } catch (error) {
    if (error instanceof InvalidImageError) throw error;
    throw new InvalidImageError();
  }
}

export async function prepareContentImage(
  input: Buffer,
  declaredMimeType: string,
) {
  if (input.byteLength === 0 || input.byteLength > env.MAX_UPLOAD_BYTES)
    throw new InvalidImageError(
      `Images must be smaller than ${Math.floor(env.MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
    );

  if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(declaredMimeType))
    throw new InvalidImageError();

  try {
    const pipeline = sharp(input, {
      failOn: "error",
      limitInputPixels: 40_000_000,
      animated: false,
    });
    const metadata = await pipeline.metadata();
    if (!metadata.format || !acceptedFormats.has(metadata.format))
      throw new InvalidImageError();

    const data = await pipeline
      .rotate()
      .resize({
        width: 1600,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 86, effort: 4 })
      .toBuffer();
    const result = await sharp(data).metadata();

    return {
      data,
      mimeType: "image/webp",
      width: result.width ?? metadata.width,
      height: result.height ?? metadata.height,
    } as const;
  } catch (error) {
    if (error instanceof InvalidImageError) throw error;
    throw new InvalidImageError();
  }
}
