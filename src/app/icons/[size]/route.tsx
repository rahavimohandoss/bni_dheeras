import { renderAppIcon } from "@/lib/app-icon";

const SIZES = new Set(["192", "512"]);

export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size } = await ctx.params;
  if (!SIZES.has(size)) return new Response("Not found", { status: 404 });
  const res = renderAppIcon(Number(size));
  res.headers.set("Cache-Control", "public, max-age=86400");
  return res;
}
