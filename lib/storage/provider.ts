import "server-only";

import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

export type StoredObject = { key: string; url: string };

export interface ObjectStorageProvider {
  putAvatar(data: Buffer): Promise<StoredObject>;
  deleteByUrl(url: string): Promise<void>;
  health(): Promise<boolean>;
}

function localRoot() {
  return path.join(process.cwd(), ".local-uploads");
}

function safeLocalPath(key: string) {
  if (!/^avatars\/[a-f0-9-]+\.webp$/i.test(key))
    throw new Error("Invalid object key");
  const root = localRoot();
  const target = path.resolve(root, key);
  if (!target.startsWith(`${root}${path.sep}`))
    throw new Error("Invalid object path");
  return target;
}

class LocalObjectStorageProvider implements ObjectStorageProvider {
  async putAvatar(data: Buffer) {
    const key = `avatars/${randomUUID()}.webp`;
    const target = safeLocalPath(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data, { flag: "wx" });
    return {
      key,
      url: `${env.APP_URL.replace(/\/$/, "")}/api/uploads/${key}`,
    };
  }

  async deleteByUrl(url: string) {
    const prefix = `${env.APP_URL.replace(/\/$/, "")}/api/uploads/`;
    if (!url.startsWith(prefix)) return;
    try {
      await unlink(safeLocalPath(url.slice(prefix.length)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  async health() {
    try {
      await mkdir(localRoot(), { recursive: true });
      await access(localRoot());
      return true;
    } catch {
      return false;
    }
  }
}

class S3ObjectStorageProvider implements ObjectStorageProvider {
  private readonly client = new S3Client({
    region: env.S3_REGION!,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID!,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY!,
    },
  });

  async putAvatar(data: Buffer) {
    const key = `avatars/${randomUUID()}.webp`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET!,
        Key: key,
        Body: data,
        ContentType: "image/webp",
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return {
      key,
      url: `${env.S3_PUBLIC_BASE_URL!.replace(/\/$/, "")}/${key}`,
    };
  }

  async deleteByUrl(url: string) {
    const prefix = `${env.S3_PUBLIC_BASE_URL!.replace(/\/$/, "")}/`;
    if (!url.startsWith(prefix)) return;
    const key = url.slice(prefix.length);
    if (!/^avatars\/[a-f0-9-]+\.webp$/i.test(key)) return;
    await this.client.send(
      new DeleteObjectCommand({ Bucket: env.S3_BUCKET!, Key: key }),
    );
  }

  async health() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET! }));
      return true;
    } catch {
      return false;
    }
  }
}

const storage: ObjectStorageProvider =
  env.STORAGE_PROVIDER === "s3"
    ? new S3ObjectStorageProvider()
    : new LocalObjectStorageProvider();

export function objectStorage() {
  return storage;
}

export function readLocalObject(key: string) {
  if (env.STORAGE_PROVIDER !== "local")
    throw new Error("Local storage is disabled");
  return readFile(safeLocalPath(key));
}
