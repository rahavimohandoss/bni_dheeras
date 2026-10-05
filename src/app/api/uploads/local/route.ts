import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { isSafeKey, MAX_IMAGE_BYTES, storageMode, verifyLocalKey } from "@/lib/storage";

export const dynamic = "force-dynamic";

const ROOT = resolve(process.cwd(), ".local-uploads");
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Development stand-in for R2 presigned uploads. Disabled when R2 is configured. */
export async function PUT(req: Request) {
  if (storageMode() !== "local") return new Response("Not found", { status: 404 });
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? "";
  const expires = Number(url.searchParams.get("expires"));
  const sig = url.searchParams.get("sig") ?? "";
  if (!isSafeKey(key) || !verifyLocalKey(key, expires, sig)) return new Response("Forbidden", { status: 403 });
  if (!TYPES.has(req.headers.get("content-type") ?? "")) return new Response("Bad type", { status: 415 });
  const body = Buffer.from(await req.arrayBuffer());
  if (body.length > MAX_IMAGE_BYTES) return new Response("Too large", { status: 413 });
  const path = join(ROOT, key);
  if (!path.startsWith(ROOT)) return new Response("Forbidden", { status: 403 });
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
  return new Response(null, { status: 200 });
}
