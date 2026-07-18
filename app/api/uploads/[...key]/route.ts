import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { readLocalObject } from "@/lib/storage/provider";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (env.STORAGE_PROVIDER !== "local")
    return new NextResponse(null, { status: 404 });
  try {
    const data = await readLocalObject((await params).key.join("/"));
    return new NextResponse(Uint8Array.from(data), {
      headers: {
        "content-type": "image/webp",
        "content-length": String(data.byteLength),
        etag: `"${createHash("sha256").update(data).digest("base64url")}"`,
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
