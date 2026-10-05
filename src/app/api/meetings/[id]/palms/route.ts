import { getBoardData } from "@/lib/attendance/board";
import { getMeetingWithVenue } from "@/lib/attendance/queries";
import { toCsv } from "@/lib/csv";
import { getCurrentMember } from "@/lib/session";
import { formatTime, toIstDateInput } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/meetings/[id]/palms">) {
  const me = await getCurrentMember();
  if (!me || !(me.caps.has("palms.view") || me.caps.has("meeting.finalize"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { id } = await ctx.params;
  const m = await getMeetingWithVenue(id);
  if (!m) return new Response("Not found", { status: 404 });
  const data = await getBoardData(m);
  const csv = toCsv([
    ["Member", "Business", "Category", "PALMS", "Time", "How", "Substitute", "Note"],
    ...data.members.map((r) => [
      r.name,
      r.business ?? "",
      r.category ?? "",
      r.status ?? "",
      r.at ? formatTime(new Date(r.at)) : "",
      r.method ?? "",
      r.substitute?.name ?? "",
      r.note ?? "",
    ]),
    [],
    ["Visitors", String(data.visitors)],
    ["Headcount", m.headcount === null ? "" : String(m.headcount)],
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="palms-${toIstDateInput(m.startsAt)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
