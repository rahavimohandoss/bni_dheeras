import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { attendance, member } from "@/db/schema";
import { expectedMembers, getMeetingWithVenue } from "@/lib/attendance/queries";
import { msUntilNextWindow, QR_WINDOW_SECONDS, signQrToken, windowAt } from "@/lib/attendance/qr-token";
import { checkinWindow } from "@/lib/attendance/rules";
import { kioskAccess } from "@/lib/kiosk";
import { publicUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Polled every ~2 s by the venue screen: current QR token, counts, welcome feed. */
export async function GET(_req: Request, ctx: RouteContext<"/api/kiosk/[meetingId]/state">) {
  const access = await kioskAccess();
  if (!access) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { meetingId } = await ctx.params;
  const m = await getMeetingWithVenue(meetingId);
  if (!m) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const now = Date.now();
  const window = checkinWindow(new Date(now), m.checkinOpensAt, m.endsAt);
  const open = m.status === "scheduled" && window === "open";

  const [expected, present, recent] = await Promise.all([
    expectedMembers(m.startsAt),
    db
      .select({ memberId: attendance.memberId })
      .from(attendance)
      .where(and(eq(attendance.meetingId, m.id), inArray(attendance.status, ["P", "L"]))),
    db
      .select({ name: member.fullName, photoKey: member.photoKey, at: attendance.checkedInAt })
      .from(attendance)
      .innerJoin(member, eq(member.id, attendance.memberId))
      .where(
        and(
          eq(attendance.meetingId, m.id),
          inArray(attendance.status, ["P", "L"]),
          isNotNull(attendance.checkedInAt),
        ),
      )
      .orderBy(desc(attendance.checkedInAt))
      .limit(8),
  ]);

  return NextResponse.json(
    {
      meeting: {
        title: m.title,
        startsAt: m.startsAt.toISOString(),
        endsAt: m.endsAt.toISOString(),
        checkinOpensAt: m.checkinOpensAt.toISOString(),
        status: m.status,
        window,
        venue: m.venue?.name ?? null,
      },
      token: open ? signQrToken(m.id, m.qrSecret, windowAt(now)) : null,
      windowSeconds: QR_WINDOW_SECONDS,
      msUntilNext: msUntilNextWindow(now),
      stats: { in: present.length, expected: expected.length },
      recent: recent.map((r) => ({ name: r.name, photoUrl: publicUrl(r.photoKey), at: r.at?.toISOString() })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
