import { getPairedKiosk } from "@/lib/kiosk";
import { getCurrentMember } from "@/lib/session";
import { getImage, isSafeKey } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Member photos and logos. The bucket is private; only signed-in members and
 * the paired venue screen (which shows photos on the welcome wall) can load
 * them. Keys are unique per upload, so browsers may cache them for good.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/media/[...key]">) {
  const { key: parts } = await ctx.params;
  const key = parts.join("/");
  if (!isSafeKey(key)) return new Response("Not found", { status: 404 });

  const allowed = (await getCurrentMember()) ?? (await getPairedKiosk());
  if (!allowed) return new Response("Unauthorized", { status: 401 });

  const image = await getImage(key);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(image.body, {
    headers: {
      "Content-Type": image.contentType,
      ...(image.size ? { "Content-Length": String(image.size) } : {}),
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
