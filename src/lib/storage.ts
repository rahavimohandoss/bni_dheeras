import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Image storage. Production uses Cloudflare R2 with short-lived presigned PUT
 * URLs and a public custom domain for reads. Without R2 settings (local dev)
 * files are written to ./.local-uploads through a signed local endpoint.
 */

export const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export type ImageType = keyof typeof IMAGE_TYPES;
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const r2 = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  publicBaseUrl: process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, ""),
};

export function storageMode(): "r2" | "local" {
  return r2.accountId && r2.accessKeyId && r2.secretAccessKey && r2.bucket && r2.publicBaseUrl
    ? "r2"
    : "local";
}

let client: S3Client | null = null;
function s3(): S3Client {
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2.accessKeyId!, secretAccessKey: r2.secretAccessKey! },
  });
  return client;
}

function localSecret(): string {
  return process.env.BETTER_AUTH_SECRET ?? "dev-only-local-upload-secret";
}

export function signLocalKey(key: string, expires: number): string {
  return createHmac("sha256", localSecret()).update(`${key}|${expires}`).digest("base64url");
}

export function verifyLocalKey(key: string, expires: number, sig: string): boolean {
  if (Date.now() > expires) return false;
  const expected = Buffer.from(signLocalKey(key, expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export type UploadTarget = { uploadUrl: string; key: string; publicUrl: string; headers: Record<string, string> };

export async function createUploadTarget(key: string, contentType: ImageType, size: number): Promise<UploadTarget> {
  if (storageMode() === "r2") {
    const uploadUrl = await getSignedUrl(
      s3(),
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
        CacheControl: "public, max-age=31536000, immutable",
      }),
      { expiresIn: 300 },
    );
    return { uploadUrl, key, publicUrl: publicUrl(key)!, headers: { "Content-Type": contentType } };
  }
  const expires = Date.now() + 5 * 60_000;
  const params = new URLSearchParams({ key, expires: String(expires), sig: signLocalKey(key, expires) });
  return {
    uploadUrl: `/api/uploads/local?${params}`,
    key,
    publicUrl: publicUrl(key)!,
    headers: { "Content-Type": contentType },
  };
}

/** Public URL for a stored object key (null-safe). */
export function publicUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (storageMode() === "r2") return `${r2.publicBaseUrl}/${key}`;
  return `/api/files/${key}`;
}

/** Object keys we generate: members/<memberId>/<kind>-<uuid>.<ext>, forms/..., awards/... */
export function isSafeKey(key: string): boolean {
  return /^[a-z]+\/[A-Za-z0-9_-]+\/[a-z]+-[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key);
}
