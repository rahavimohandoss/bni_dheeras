import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { member } from "@/db/schema";
import { calendarItems } from "@/lib/calendar";
import { buildIcs } from "@/lib/ical";

export const dynamic = "force-dynamic";

/**
 * Private calendar feed for one member (Google / Apple Calendar "subscribe by
 * URL"). The token is secret per member; inactive members get nothing.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/calendar/[token]">) {
  const { token: raw } = await ctx.params;
  const token = raw.replace(/\.ics$/, "");
  if (!/^[0-9a-f]{32}$/.test(token)) return new Response("Not found", { status: 404 });
  const [m] = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.calendarToken, token), eq(member.status, "active")));
  if (!m) return new Response("Not found", { status: 404 });

  const now = Date.now();
  const items = await calendarItems(new Date(now - 30 * 86_400_000), new Date(now + 180 * 86_400_000));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const ics = buildIcs(
    "BNI Dheeras",
    items.map((i) => ({
      uid: `${i.source}-${i.id}`,
      title: i.presenter ? `${i.title} (${i.presenter.name})` : i.title,
      start: i.startsAt,
      end: i.endsAt,
      location: i.location,
      description: i.description,
      url: i.link ?? (appUrl ? `${appUrl}/calendar` : null),
      cancelled: i.cancelled,
    })),
  );
  return new Response(ics, {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "private, max-age=900" },
  });
}
