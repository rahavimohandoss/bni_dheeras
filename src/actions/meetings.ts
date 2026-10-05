"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { MEETING_KINDS, MEETING_MODES, meeting, venue } from "@/db/schema";
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

const timesSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick an end time"),
  /** Empty = check-in counts as late from the exact start time. */
  graceMinutes: optionalInt(0, 120),
  /** Empty = use the venue's geofence. */
  geofenceM: optionalInt(25, 2000),
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
    const venueId = await checkVenue(data.mode, data.venueId);
    const [row] = await db
      .insert(meeting)
      .values({
        title: data.title,
        kind: data.kind,
        mode: data.mode,
        venueId,
        ...times,
        graceMinutes: data.graceMinutes,
        geofenceM: data.geofenceM,
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

/** Creates the same weekly meeting for N weeks from the first date. */
export async function generateWeekly(input: z.input<typeof weeklySchema>): Promise<ActionResult<{ count: number }>> {
  return runAction(async () => {
    const me = await assertCap("meetings.manage");
    const data = weeklySchema.parse(input);
    const first = await resolveTimes(data);
    const venueId = await checkVenue("in_person", data.venueId);
    const rows = Array.from({ length: data.weeks }, (_, w) => ({
      title: data.title,
      kind: "weekly" as const,
      mode: "in_person" as const,
      venueId,
      startsAt: addDays(first.startsAt, w * 7),
      endsAt: addDays(first.endsAt, w * 7),
      checkinOpensAt: addDays(first.checkinOpensAt, w * 7),
      graceMinutes: data.graceMinutes,
      geofenceM: data.geofenceM,
      qrSecret: newMeetingSecret(),
    }));
    await db.insert(meeting).values(rows);
    await audit({ actorId: me.id, action: "meeting.generate_weekly", entity: "meeting", after: { ...data } });
    refresh();
    return { count: rows.length };
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
    const venueId = await checkVenue(data.mode, data.venueId);
    await db
      .update(meeting)
      .set({
        title: data.title,
        kind: data.kind,
        mode: data.mode,
        venueId,
        ...times,
        graceMinutes: data.graceMinutes,
        geofenceM: data.geofenceM,
      })
      .where(and(eq(meeting.id, before.id), eq(meeting.status, "scheduled")));
    await audit({
      actorId: me.id,
      action: "meeting.update",
      entity: "meeting",
      entityId: before.id,
      before: { startsAt: before.startsAt, graceMinutes: before.graceMinutes, geofenceM: before.geofenceM },
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
