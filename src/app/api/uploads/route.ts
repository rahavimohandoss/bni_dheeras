import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/session";
import { IMAGE_TYPES, type ImageType, looksLikeImage, MAX_IMAGE_BYTES, putImage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Members upload their (browser-compressed) photo or logo here; the server
 * checks it and stores it. Returns the object key, which the client then saves
 * with the setMyImage action.
 */
export async function POST(req: Request) {
  const me = await getCurrentMember();
  if (!me) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  // Same-origin only (session cookies are SameSite=Lax as well).
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const kind = new URL(req.url).searchParams.get("kind");
  if (kind !== "photo" && kind !== "logo") return NextResponse.json({ error: "Unknown image kind." }, { status: 400 });

  const type = req.headers.get("content-type")?.split(";")[0].trim() as ImageType | undefined;
  if (!type || !(type in IMAGE_TYPES)) {
    return NextResponse.json({ error: "Use a JPG, PNG or WebP image." }, { status: 415 });
  }
  if (Number(req.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be under 3 MB." }, { status: 413 });
  }
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.length === 0 || body.length > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: "Image must be under 3 MB." }, { status: 413 });
  }
  if (!looksLikeImage(type, body)) return NextResponse.json({ error: "That file isn't a valid image." }, { status: 415 });

  const key = `members/${me.id}/${kind}-${crypto.randomUUID()}.${IMAGE_TYPES[type]}`;
  try {
    await putImage(key, body, type);
  } catch (error) {
    console.error("[uploads] store failed", error);
    return NextResponse.json({ error: "Couldn't store the image. Please try again." }, { status: 502 });
  }
  return NextResponse.json({ key });
}
