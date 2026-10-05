import { NextResponse } from "next/server";
import { getBoardData } from "@/lib/attendance/board";
import { getMeetingWithVenue } from "@/lib/attendance/queries";
import { getCurrentMember } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Polled every few seconds by the LVH live board. */
export async function GET(_req: Request, ctx: RouteContext<"/api/lvh/[meetingId]/feed">) {
  const me = await getCurrentMember();
  if (!me || !(me.caps.has("kiosk.run") || me.caps.has("palms.view"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { meetingId } = await ctx.params;
  const m = await getMeetingWithVenue(meetingId);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const data = await getBoardData(m);
  return NextResponse.json(
    {
      meeting: {
        id: m.id,
        title: m.title,
        status: m.status,
        startsAt: m.startsAt.toISOString(),
        endsAt: m.endsAt.toISOString(),
        graceMinutes: m.graceMinutes,
        mode: m.mode,
        headcount: m.headcount,
      },
      ...data,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
