import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isSafeKey, LOCAL_UPLOAD_ROOT as ROOT, storageMode } from "@/lib/storage";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Serves locally stored uploads in development. In production images come from the storage bucket. */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...key]">) {
  if (storageMode() !== "local") return new Response("Not found", { status: 404 });
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  if (!isSafeKey(key)) return new Response("Not found", { status: 404 });
  const path = join(ROOT, key);
  if (!path.startsWith(ROOT)) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path);
    return new Response(data, {
      headers: {
        "Content-Type": TYPES[key.split(".").pop()!] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
