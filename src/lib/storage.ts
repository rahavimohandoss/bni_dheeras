import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Image storage on any S3-compatible bucket. Production uses Neon Object
 * Storage (a private bucket in the same Neon project); Cloudflare R2 works
 * with the same settings. Uploads and reads both go through our own server
 * (/api/uploads, /api/media), so the bucket stays private and needs no CORS.
 * Without STORAGE_* settings in development, files live in ./.local-uploads.
 */

export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type ImageType = keyof typeof IMAGE_TYPES;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const LOCAL_UPLOAD_ROOT = resolve(process.cwd(), ".local-uploads");

type S3Settings = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function s3Settings(): S3Settings | null {
  const endpoint = process.env.STORAGE_ENDPOINT?.replace(/\/+$/, "");
  const bucket = process.env.STORAGE_BUCKET;
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return {
    endpoint,
    region: process.env.STORAGE_REGION || "auto",
    bucket,
    accessKeyId,
    secretAccessKey,
  };
}

export function storageMode(): "s3" | "local" {
  return s3Settings() ? "s3" : "local";
}

let client: S3Client | null = null;
function s3(cfg: S3Settings): S3Client {
  client ??= new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    // S3-compatible stores (Neon, R2) don't accept the SDK's default extra checksums.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

export async function putImage(key: string, body: Uint8Array, contentType: ImageType): Promise<void> {
  const cfg = s3Settings();
  if (cfg) {
    await s3(cfg).send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return;
  }
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error("Image storage is not configured (set the STORAGE_* environment variables).");
  }
  const path = join(LOCAL_UPLOAD_ROOT, key);
  if (!path.startsWith(LOCAL_UPLOAD_ROOT)) throw new Error("Invalid key");
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

/**
 * URL for a stored image (null-safe). By default images are served by
 * /api/media, which checks the viewer is a member (or the paired venue
 * screen), so the bucket can stay private. Set STORAGE_PUBLIC_BASE_URL only
 * for a public bucket/CDN that should serve images directly.
 */
export function publicUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  const direct = process.env.STORAGE_PUBLIC_BASE_URL?.replace(/\/+$/, "");
  return direct && s3Settings() ? `${direct}/${key}` : `/api/media/${key}`;
}

export type StoredImage = { body: BodyInit; contentType: string; size?: number };

const TYPE_BY_EXT: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Reads an image from the bucket (or the local folder in development); null when missing. */
export async function getImage(key: string): Promise<StoredImage | null> {
  const fallbackType = TYPE_BY_EXT[key.split(".").pop() ?? ""] ?? "application/octet-stream";
  const cfg = s3Settings();
  if (cfg) {
    try {
      const res = await s3(cfg).send(new GetObjectCommand({ Bucket: cfg.bucket, Key: key }));
      if (!res.Body) return null;
      return {
        body: res.Body.transformToWebStream(),
        contentType: res.ContentType || fallbackType,
        size: res.ContentLength,
      };
    } catch (error) {
      if ((error as { name?: string }).name === "NoSuchKey") return null;
      throw error;
    }
  }
  const path = join(LOCAL_UPLOAD_ROOT, key);
  if (!path.startsWith(LOCAL_UPLOAD_ROOT)) return null;
  try {
    const data = await readFile(path);
    return { body: new Uint8Array(data), contentType: fallbackType, size: data.length };
  } catch {
    return null;
  }
}

/** Object keys we generate: members/<memberId>/<kind>-<uuid>.<ext> */
export function isSafeKey(key: string): boolean {
  return /^[a-z]+\/[A-Za-z0-9_-]+\/[a-z]+-[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key);
}

/** Checks the file's leading bytes really match the declared image type. */
export function looksLikeImage(type: ImageType, bytes: Uint8Array): boolean {
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
  switch (type) {
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return bytes[0] === 0x89 && ascii(1, 4) === "PNG";
    case "image/webp":
      return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  }
}
