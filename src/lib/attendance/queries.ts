import "server-only";
import { and, asc, count, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { type DBOrTx, db } from "@/db";
import {
  attendance,
  award,
  leaveRequest,
  meeting,
  member,
  substitute,
  venue,
} from "@/db/schema";
import { subtractMonths, toIstDateInput } from "@/lib/time";

/** What is connected to a meeting: PALMS (attendance rows) and recognitions (all, and how many published). */
export type RecordCounts = { records: number; recognitions: number; published: number };

export async function recordCounts(meetingIds: string[]): Promise<Map<string, RecordCounts>> {
  const counts = new Map<string, RecordCounts>(meetingIds.map((id) => [id, { records: 0, recognitions: 0, published: 0 }]));
  if (meetingIds.length === 0) return counts;
  const [records, recognitions] = await Promise.all([
    db
      .select({ id: attendance.meetingId, n: count() })
      .from(attendance)
      .where(inArray(attendance.meetingId, meetingIds))
      .groupBy(attendance.meetingId),
    db
      .select({ id: award.meetingId, n: count(), published: sql<number>`count(*) filter (where ${award.published})::int` })
      .from(award)
      .where(inArray(award.meetingId, meetingIds))
      .groupBy(award.meetingId),
  ]);
  for (const r of records) counts.get(r.id)!.records = r.n;
  for (const r of recognitions) Object.assign(counts.get(r.id)!, { recognitions: r.n, published: r.published });
  return counts;
}

export type MeetingWithVenue = typeof meeting.$inferSelect & {
  venue: typeof venue.$inferSelect | null;
};

export async function getMeetingWithVenue(id: string, conn: DBOrTx = db): Promise<MeetingWithVenue | null> {
  const rows = await conn
    .select({ meeting, venue })
    .from(meeting)
    .leftJoin(venue, eq(venue.id, meeting.venueId))
    .where(eq(meeting.id, id));
  const row = rows[0];
  return row ? { ...row.meeting, venue: row.venue } : null;
}

/** The meeting members should act on now: in progress, or the next one. */
export async function getCurrentOrNextMeeting(now = new Date()): Promise<MeetingWithVenue | null> {
  const rows = await db
    .select({ meeting, venue })
    .from(meeting)
    .leftJoin(venue, eq(venue.id, meeting.venueId))
    .where(and(eq(meeting.status, "scheduled"), gte(meeting.endsAt, now)))
    .orderBy(asc(meeting.startsAt))
    .limit(1);
  const row = rows[0];
  return row ? { ...row.meeting, venue: row.venue } : null;
}

/** Meetings whose check-in window is open now or that run today (for LVH/kiosk). */
export async function getActiveMeetings(now = new Date()): Promise<MeetingWithVenue[]> {
  const dayAhead = new Date(now.getTime() + 18 * 3600_000);
  const rows = await db
    .select({ meeting, venue })
    .from(meeting)
    .leftJoin(venue, eq(venue.id, meeting.venueId))
    .where(
      and(
        eq(meeting.status, "scheduled"),
        gte(meeting.endsAt, new Date(now.getTime() - 6 * 3600_000)),
        lte(meeting.checkinOpensAt, dayAhead),
      ),
    )
    .orderBy(asc(meeting.startsAt));
  return rows.map((r) => ({ ...r.meeting, venue: r.venue }));
}

/** Active chapter members expected at a meeting (joined on or before its date; not admin-only accounts). */
export async function expectedMembers(meetingStartsAt: Date, conn: DBOrTx = db) {
  const day = toIstDateInput(meetingStartsAt);
  return conn
    .select({
      id: member.id,
      fullName: member.fullName,
      businessName: member.businessName,
      category: member.category,
      phone: member.phone,
      photoKey: member.photoKey,
    })
    .from(member)
    .where(
      and(
        eq(member.status, "active"),
        eq(member.isChapterMember, true),
        or(isNull(member.joinedOn), lte(member.joinedOn, day)),
      ),
    )
    .orderBy(asc(member.fullName));
}

export async function memberMeetingState(memberId: string, meetingId: string) {
  const [att] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.meetingId, meetingId), eq(attendance.memberId, memberId)));
  const [leave] = await db
    .select()
    .from(leaveRequest)
    .where(and(eq(leaveRequest.meetingId, meetingId), eq(leaveRequest.memberId, memberId)));
  const [sub] = await db
    .select()
    .from(substitute)
    .where(and(eq(substitute.meetingId, meetingId), eq(substitute.memberId, memberId)));
  return { attendance: att ?? null, leave: leave ?? null, substitute: sub ?? null };
}

/** Absences (A) in finalized meetings over the rolling window. */
export async function absenceCounts(memberIds: string[], months: number, now = new Date()) {
  if (memberIds.length === 0) return new Map<string, number>();
  const since = subtractMonths(now, months);
  const rows = await db
    .select({ memberId: attendance.memberId, n: sql<number>`count(*)::int` })
    .from(attendance)
    .innerJoin(meeting, eq(meeting.id, attendance.meetingId))
    .where(
      and(
        inArray(attendance.memberId, memberIds),
        eq(attendance.status, "A"),
        eq(meeting.status, "finalized"),
        gte(meeting.startsAt, since),
      ),
    )
    .groupBy(attendance.memberId);
  return new Map(rows.map((r) => [r.memberId, r.n]));
}

export async function lateCounts(memberIds: string[], weeks: number, now = new Date()) {
  if (memberIds.length === 0) return new Map<string, number>();
  const since = new Date(now.getTime() - weeks * 7 * 86_400_000);
  const rows = await db
    .select({ memberId: attendance.memberId, n: sql<number>`count(*)::int` })
    .from(attendance)
    .innerJoin(meeting, eq(meeting.id, attendance.meetingId))
    .where(
      and(
        inArray(attendance.memberId, memberIds),
        eq(attendance.status, "L"),
        gte(meeting.startsAt, since),
      ),
    )
    .groupBy(attendance.memberId);
  return new Map(rows.map((r) => [r.memberId, r.n]));
}
