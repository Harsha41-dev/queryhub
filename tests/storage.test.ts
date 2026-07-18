import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { InvalidImageError, prepareAvatar } from "@/lib/storage/image";

describe("avatar processing", () => {
  it("validates image bytes and re-encodes a bounded metadata-free WebP", async () => {
    const source = await sharp({
      create: {
        width: 32,
        height: 20,
        channels: 4,
        background: { r: 79, g: 70, b: 229, alpha: 1 },
      },
    })
      .png()
      .withMetadata()
      .toBuffer();
    const result = await prepareAvatar(source, "image/png");
    const metadata = await sharp(result.data).metadata();
    expect(result.mimeType).toBe("image/webp");
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    expect(metadata.exif).toBeUndefined();
  });

  it("rejects SVG and mismatched image payloads", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    await expect(prepareAvatar(svg, "image/svg+xml")).rejects.toBeInstanceOf(
      InvalidImageError,
    );
    await expect(
      prepareAvatar(Buffer.from("not an image"), "image/png"),
    ).rejects.toBeInstanceOf(InvalidImageError);
  });
});
