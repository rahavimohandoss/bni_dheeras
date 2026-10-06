import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  attendance,
  type AttendanceMethod,
  type AttendanceStatus,
  checkinAttempt,
  leaveRequest,
  member,
  substitute,
} from "@/db/schema";
import { publicUrl } from "@/lib/storage";
import { expectedMembers, type MeetingWithVenue } from "./queries";

export type BoardMember = {
  id: string;
  name: string;
  business: string | null;
  category: string | null;
  phone: string | null;
  photoUrl: string | null;
  status: AttendanceStatus | null;
  method: AttendanceMethod | null;
  at: string | null;
  flags: string[];
  note: string | null;
  leave: { kind: "medical" | "informed"; status: string; reason: string | null } | null;
  substitute: { name: string; phone: string; business: string | null; arrived: boolean } | null;
};

export type BoardData = {
  members: BoardMember[];
  rejected: { at: string; name: string | null; reason: string; via: string }[];
  visitors: number;
};

/** Everything the LVH board and the PALMS summary need for one meeting. */
export async function getBoardData(m: MeetingWithVenue): Promise<BoardData> {
  const [expected, rows, leaves, subs, attempts] = await Promise.all([
    expectedMembers(m.startsAt),
    db.select().from(attendance).where(eq(attendance.meetingId, m.id)),
    db.select().from(leaveRequest).where(eq(leaveRequest.meetingId, m.id)),
    db.select().from(substitute).where(eq(substitute.meetingId, m.id)),
    db
      .select({
        at: checkinAttempt.at,
        name: member.fullName,
        reason: checkinAttempt.reason,
        via: checkinAttempt.via,
      })
      .from(checkinAttempt)
      .leftJoin(member, eq(member.id, checkinAttempt.memberId))
      .where(and(eq(checkinAttempt.meetingId, m.id), eq(checkinAttempt.result, "rejected")))
      .orderBy(desc(checkinAttempt.at))
      .limit(40),
  ]);

  const byMember = new Map(rows.map((r) => [r.memberId, r]));
  // Members who checked in but are no longer "expected" (e.g. joined later) still appear.
  const expectedIds = new Set(expected.map((e) => e.id));
  const extraIds = rows.map((r) => r.memberId).filter((id) => !expectedIds.has(id));
  const extras = extraIds.length
    ? await db
        .select({
          id: member.id,
          fullName: member.fullName,
          businessName: member.businessName,
          category: member.category,
          phone: member.phone,
          photoKey: member.photoKey,
        })
        .from(member)
        // Admin-only accounts never show, even if an old attendance row exists.
        .where(and(inArray(member.id, extraIds), eq(member.isChapterMember, true)))
    : [];

  const members: BoardMember[] = [...expected, ...extras].map((e) => {
    const a = byMember.get(e.id);
    const l = leaves.find((x) => x.memberId === e.id);
    const s = subs.find((x) => x.memberId === e.id);
    return {
      id: e.id,
      name: e.fullName,
      business: e.businessName,
      category: e.category,
      phone: e.phone,
      photoUrl: publicUrl(e.photoKey),
      status: a?.status ?? null,
      method: a?.method ?? null,
      at: a?.checkedInAt?.toISOString() ?? null,
      flags: a?.flags ?? [],
      note: a?.note ?? null,
      leave: l ? { kind: l.kind, status: l.status, reason: l.reason } : null,
      substitute: s ? { name: s.name, phone: s.phone, business: s.business, arrived: !!s.arrivedAt } : null,
    };
  });

  return {
    members,
    rejected: attempts.map((a) => ({ at: a.at.toISOString(), name: a.name, reason: a.reason, via: a.via })),
    visitors: m.visitorCount ?? 0,
  };
}
