import { timingSafeEqual } from "node:crypto";
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { absenceFollowup, attendance, meeting, member } from "@/db/schema";
import { absenceCounts, lateCounts } from "@/lib/attendance/queries";
import { notify, membersWithRoles } from "@/lib/notify";
import { getAttendanceSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Weekly attendance report for the Attendance Coordinator and Secretary
 * (Vercel Cron, Mondays). Last finalized meeting, members at or near the
 * absence limit, repeated lateness, and absentee calls still pending.
 */
export async function GET(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const settings = await getAttendanceSettings();
  const [last] = await db
    .select()
    .from(meeting)
    .where(and(eq(meeting.status, "finalized"), gte(meeting.startsAt, new Date(Date.now() - 14 * 86_400_000))))
    .orderBy(desc(meeting.startsAt))
    .limit(1);
  const recipients = await membersWithRoles(["attendance_coordinator", "secretary_treasurer"]);
  if (!last || recipients.length === 0) return Response.json({ sent: false, reason: "nothing to report" });

  const rows = await db.select().from(attendance).where(eq(attendance.meetingId, last.id));
  const tally = { P: 0, L: 0, A: 0, M: 0, S: 0 };
  for (const r of rows) tally[r.status]++;

  const active = await db.select({ id: member.id, name: member.fullName }).from(member).where(eq(member.status, "active"));
  const ids = active.map((a) => a.id);
  const names = new Map(active.map((a) => [a.id, a.name]));
  const [absences, lates, followups] = await Promise.all([
    absenceCounts(ids, settings.absenceWindowMonths),
    lateCounts(ids, settings.lateFlagWeeks),
    db.select().from(absenceFollowup).where(eq(absenceFollowup.meetingId, last.id)),
  ]);
  const atRisk = [...absences.entries()]
    .filter(([, n]) => n >= settings.absenceLimit - 1)
    .map(([id, n]) => `• ${names.get(id)}: ${n} absences`);
  const late = [...lates.entries()]
    .filter(([, n]) => n >= settings.lateFlagCount)
    .map(([id, n]) => `• ${names.get(id)}: ${n} late`);
  const called = new Set(followups.filter((f) => f.calledAt).map((f) => f.memberId));
  const pendingCalls = rows.filter((r) => r.status === "A" && !called.has(r.memberId)).map((r) => `• ${names.get(r.memberId)}`);

  const body = [
    `Meeting ${formatDate(last.startsAt)}: P ${tally.P} · L ${tally.L} · A ${tally.A} · M ${tally.M} · S ${tally.S}`,
    "",
    `At or near the absence limit (${settings.absenceLimit} in ${settings.absenceWindowMonths} months):`,
    ...(atRisk.length ? atRisk : ["• none"]),
    "",
    `Repeated lateness (${settings.lateFlagCount}+ in ${settings.lateFlagWeeks} weeks):`,
    ...(late.length ? late : ["• none"]),
    "",
    "Absentees not called yet:",
    ...(pendingCalls.length ? pendingCalls : ["• none"]),
  ].join("\n");

  await notify(recipients, { title: `Weekly attendance report · ${formatDate(last.startsAt)}`, body, link: `/meetings/${last.id}/summary` }, { email: true });
  return Response.json({ sent: true, recipients: recipients.length });
}
