"use server";

import { and, count, eq, gt, lt, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import {
  absenceFollowup,
  attendance,
  award,
  calendarEvent,
  checkinAttempt,
  MEETING_KINDS,
  MEETING_MODES,
  meeting,
  substitute,
  venue,
} from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { newMeetingSecret } from "@/lib/attendance/qr-token";
import { audit } from "@/lib/audit";
import { assertCap } from "@/lib/session";
import { getAttendanceSettings } from "@/lib/settings";
import { addDays, addMinutes, istToDate } from "@/lib/time";

const optionalInt = (min: number, max: number) =>
  z
    .union([z.string(), z.number(), z.null(), z.undefined()])
    .transform((v) => (v === "" || v === null || v === undefined ? null : Number(v)))
    .pipe(z.number().int().min(min).max(max).nullable());

/* The chapter uses no grace period: a check-in after the exact start time is Late. */
const timesSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick an end time"),
  opensBeforeMin: optionalInt(0, 240),
});

const meetingSchema = timesSchema.extend({
  title: z.string().trim().min(2).max(120),
  kind: z.enum(MEETING_KINDS),
  mode: z.enum(MEETING_MODES),
  venueId: z.string().optional().transform((v) => v || null),
});

async function resolveTimes(data: z.output<typeof timesSchema>) {
  const settings = await getAttendanceSettings();
  const startsAt = istToDate(data.date, data.startTime);
  const endsAt = istToDate(data.date, data.endTime);
  if (endsAt <= startsAt) throw new UserError("End time must be after the start time.");
  const opensBefore = data.opensBeforeMin ?? settings.checkinOpensBeforeMin;
  return { startsAt, endsAt, checkinOpensAt: addMinutes(startsAt, -opensBefore) };
}

/** One meeting per start time: a copy at the same moment only confuses PALMS and recognitions. */
async function assertNoClash(startsAt: Date, exceptId?: string) {
  const [clash] = await db
    .select({ id: meeting.id })
    .from(meeting)
    .where(
      and(
        // Within the same minute counts as the same time.
        gt(meeting.startsAt, new Date(startsAt.getTime() - 60_000)),
        lt(meeting.startsAt, new Date(startsAt.getTime() + 60_000)),
        ne(meeting.status, "cancelled"),
        exceptId ? ne(meeting.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  if (clash) throw new UserError("There's already a meeting at that date and time. Open it from Admin → Meetings instead.");
}

async function checkVenue(mode: string, venueId: string | null) {
  if (mode === "online") return null;
  if (!venueId) throw new UserError("Choose a venue for an in-person meeting.");
  const [v] = await db.select({ id: venue.id }).from(venue).where(eq(venue.id, venueId));
  if (!v) throw new UserError("Venue not found.");
  return v.id;
}

export async function createMeeting(input: z.input<typeof meetingSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const me = await assertCap("meetings.manage");
    const data = meetingSchema.parse(input);
    const times = await resolveTimes(data);
    await assertNoClash(times.startsAt);
    const venueId = await checkVenue(data.mode, data.venueId);
    const [row] = await db
      .insert(meeting)
      .values({
        title: data.title,
        kind: data.kind,
        mode: data.mode,
        venueId,
        ...times,
        graceMinutes: null,
        qrSecret: newMeetingSecret(),
      })
      .returning({ id: meeting.id });
    await audit({ actorId: me.id, action: "meeting.create", entity: "meeting", entityId: row.id, after: data });
    refresh();
    return { id: row.id };
  });
}

const weeklySchema = timesSchema.extend({
  title: z.string().trim().min(2).max(120),
  venueId: z.string().min(1, "Choose a venue"),
  weeks: z.coerce.number().int().min(1).max(26),
});

/**
 * Creates the same weekly meeting for N weeks from the first date. Weeks that
 * already have a meeting at that exact time are skipped, so pressing the
 * button twice doesn't create duplicates.
 */
export async function generateWeekly(input: z.input<typeof weeklySchema>): Promise<ActionResult<{ count: number; skipped: number }>> {
  return runAction(async () => {
    const me = await assertCap("meetings.manage");
    const data = weeklySchema.parse(input);
    const first = await resolveTimes(data);
    const venueId = await checkVenue("in_person", data.venueId);
    const planned = Array.from({ length: data.weeks }, (_, w) => ({
      title: data.title,
      kind: "weekly" as const,
      mode: "in_person" as const,
      venueId,
      startsAt: addDays(first.startsAt, w * 7),
      endsAt: addDays(first.endsAt, w * 7),
      checkinOpensAt: addDays(first.checkinOpensAt, w * 7),
      graceMinutes: null,
      qrSecret: newMeetingSecret(),
    }));
    // Weeks that already have a meeting at that time (within the same minute) are skipped.
    const taken = (
      await db
        .select({ startsAt: meeting.startsAt })
        .from(meeting)
        .where(
          and(
            gt(meeting.startsAt, new Date(planned[0].startsAt.getTime() - 60_000)),
            lt(meeting.startsAt, new Date(planned[planned.length - 1].startsAt.getTime() + 60_000)),
            ne(meeting.status, "cancelled"),
          ),
        )
    ).map((m) => m.startsAt.getTime());
    const rows = planned.filter((p) => !taken.some((t) => Math.abs(t - p.startsAt.getTime()) < 60_000));
    if (rows.length) await db.insert(meeting).values(rows);
    await audit({ actorId: me.id, action: "meeting.generate_weekly", entity: "meeting", after: { ...data, created: rows.length } });
    refresh();
    return { count: rows.length, skipped: planned.length - rows.length };
  });
}

export async function updateMeeting(id: string, input: z.input<typeof meetingSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("meetings.manage");
    const data = meetingSchema.parse(input);
    const [before] = await db.select().from(meeting).where(eq(meeting.id, z.uuid().parse(id)));
    if (!before) throw new UserError("Meeting not found.");
    if (before.status !== "scheduled") throw new UserError("A finalized or cancelled meeting can't be edited.");
    const times = await resolveTimes(data);
    await assertNoClash(times.startsAt, before.id);
    const venueId = await checkVenue(data.mode, data.venueId);
    await db
      .update(meeting)
      .set({
        title: data.title,
        kind: data.kind,
        mode: data.mode,
        venueId,
        ...times,
        graceMinutes: null,
      })
      .where(and(eq(meeting.id, before.id), eq(meeting.status, "scheduled")));
    await audit({
      actorId: me.id,
      action: "meeting.update",
      entity: "meeting",
      entityId: before.id,
      before: { title: before.title, startsAt: before.startsAt },
      after: data,
    });
    refresh();
    return null;
  });
}

export async function cancelMeeting(id: string, reason: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("meetings.manage");
    const why = z.string().trim().min(3, "Give a reason").max(200).parse(reason);
    const [row] = await db
      .update(meeting)
      .set({ status: "cancelled", notes: why })
      .where(and(eq(meeting.id, z.uuid().parse(id)), eq(meeting.status, "scheduled")))
      .returning({ id: meeting.id });
    if (!row) throw new UserError("Only a scheduled meeting can be cancelled.");
    await audit({ actorId: me.id, action: "meeting.cancel", entity: "meeting", entityId: row.id, reason: why });
    refresh();
    return null;
  });
}

/** Undo a cancellation, as long as the meeting hasn't ended yet. */
export async function restoreMeeting(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("meetings.manage");
    const [m] = await db.select().from(meeting).where(eq(meeting.id, z.uuid().parse(id)));
    if (!m || m.status !== "cancelled") throw new UserError("Only a cancelled meeting can be restored.");
    if (m.endsAt <= new Date()) throw new UserError("This meeting is already over.");
    await assertNoClash(m.startsAt, m.id);
    await db.update(meeting).set({ status: "scheduled", notes: null }).where(eq(meeting.id, m.id));
    await audit({ actorId: me.id, action: "meeting.restore", entity: "meeting", entityId: m.id });
    refresh();
    return null;
  });
}

/**
 * Clears what was recorded at a meeting but keeps the meeting, so it can be
 * picked and used again: attendance, the check-in log, absence follow-ups,
 * substitute arrivals, the visitor count and the headcount. A finalized
 * meeting opens again. Recognitions, leave and substitute registrations stay.
 * This is PALMS history, so only the President or an admin, with a reason.
 */
export async function clearMeetingAttendance(id: string, reason?: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("meetings.manage");
    if (!me.fullAccess) throw new UserError("Only the President or an admin can clear a meeting's attendance.");
    const why = z.string().trim().min(3, "Give a reason for clearing the attendance.").max(300).parse(reason ?? "");
    const [m] = await db.select().from(meeting).where(eq(meeting.id, z.uuid().parse(id)));
    if (!m) throw new UserError("Meeting not found.");
    await db.transaction(async (tx) => {
      const removed = await tx
        .delete(attendance)
        .where(eq(attendance.meetingId, m.id))
        .returning({ memberId: attendance.memberId, status: attendance.status, method: attendance.method, checkedInAt: attendance.checkedInAt });
      await tx.delete(checkinAttempt).where(eq(checkinAttempt.meetingId, m.id));
      await tx.delete(absenceFollowup).where(eq(absenceFollowup.meetingId, m.id));
      await tx.update(substitute).set({ arrivedAt: null, confirmedById: null }).where(eq(substitute.meetingId, m.id));
      await tx
        .update(meeting)
        .set({
          visitorCount: null,
          headcount: null,
          ...(m.status === "finalized" ? { status: "scheduled" as const, finalizedAt: null, finalizedById: null } : {}),
        })
        .where(eq(meeting.id, m.id));
      await audit(
        {
          actorId: me.id,
          action: "meeting.clear_attendance",
          entity: "meeting",
          entityId: m.id,
          before: { status: m.status, visitors: m.visitorCount, headcount: m.headcount, attendance: removed },
          reason: why,
        },
        tx,
      );
    });
    refresh();
    return null;
  });
}

/**
 * Deletes a meeting. Its PALMS and recognitions are connected to it and would
 * go with it, so a meeting with PALMS (attendance, or finalized) or published
 * recognitions can't be deleted: clear those first (Attendance & PALMS →
 * Clear PALMS, Weekly recognitions → Clear all). Draft recognitions, leave and
 * substitute requests go with the meeting; the audit log keeps the drafts.
 */
export async function deleteMeeting(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("meetings.manage");
    const [m] = await db.select().from(meeting).where(eq(meeting.id, z.uuid().parse(id)));
    if (!m) throw new UserError("Meeting not found.");
    const [[{ records }], awards] = await Promise.all([
      db.select({ records: count() }).from(attendance).where(eq(attendance.meetingId, m.id)),
      db
        .select({ awardTypeId: award.awardTypeId, memberId: award.memberId, published: award.published })
        .from(award)
        .where(eq(award.meetingId, m.id)),
    ]);
    if (records > 0 || m.status === "finalized") {
      throw new UserError("This meeting has PALMS. Clear the PALMS first (Attendance & PALMS → Clear PALMS), then delete it.");
    }
    if (awards.some((a) => a.published)) {
      throw new UserError("This meeting has published recognitions. Clear them first (Weekly recognitions → Clear all), then delete it.");
    }
    await db.transaction(async (tx) => {
      // Calendar slots linked to it (e.g. a feature presentation) stay on the calendar.
      await tx.update(calendarEvent).set({ meetingId: null }).where(eq(calendarEvent.meetingId, m.id));
      // Draft recognitions, leave and substitute requests go with it (ON DELETE CASCADE).
      await tx.delete(meeting).where(eq(meeting.id, m.id));
      await audit(
        {
          actorId: me.id,
          action: "meeting.delete",
          entity: "meeting",
          entityId: m.id,
          before: { title: m.title, startsAt: m.startsAt, status: m.status, draftRecognitions: awards },
        },
        tx,
      );
    });
    refresh();
    return null;
  });
}
