"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { absenceFollowup, meeting } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import {
  confirmSubstitute,
  finalizeMeeting,
  manualCheckin,
  removeCheckin,
} from "@/lib/attendance/service";
import { audit } from "@/lib/audit";
import { assertAnyCap, assertCap } from "@/lib/session";

const reason = z.string().trim().min(3, "Give a reason (at least 3 characters)").max(200);

export async function lvhManualCheckin(input: {
  meetingId: string;
  memberId: string;
  status: "P" | "L";
  reason: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("attendance.manual");
    await manualCheckin({
      actorId: me.id,
      meetingId: z.uuid().parse(input.meetingId),
      memberId: z.string().min(1).parse(input.memberId),
      status: z.enum(["P", "L"]).parse(input.status),
      reason: reason.parse(input.reason),
    });
    return null;
  });
}

export async function lvhRemoveCheckin(input: { meetingId: string; memberId: string; reason: string }): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("attendance.manual");
    await removeCheckin({
      actorId: me.id,
      meetingId: z.uuid().parse(input.meetingId),
      memberId: z.string().min(1).parse(input.memberId),
      reason: reason.parse(input.reason),
    });
    return null;
  });
}

export async function lvhConfirmSubstitute(input: { meetingId: string; memberId: string }): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("attendance.manual");
    await confirmSubstitute({ actorId: me.id, meetingId: z.uuid().parse(input.meetingId), memberId: input.memberId });
    return null;
  });
}

export async function lvhFinalize(input: { meetingId: string; headcount: number | null }): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("meeting.finalize");
    const headcount = input.headcount === null ? null : z.number().int().min(0).max(500).parse(input.headcount);
    await finalizeMeeting({ actorId: me.id, meetingId: z.uuid().parse(input.meetingId), headcount });
    refresh();
    return null;
  });
}

/**
 * Opens a finalized meeting again so the LVH team can correct a status on the
 * board, then finalize again. The reason goes into the audit log.
 */
export async function lvhReopen(input: { meetingId: string; reason: string }): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("meeting.finalize");
    const meetingId = z.uuid().parse(input.meetingId);
    const why = reason.parse(input.reason);
    const [row] = await db
      .update(meeting)
      .set({ status: "scheduled", finalizedAt: null, finalizedById: null })
      .where(and(eq(meeting.id, meetingId), eq(meeting.status, "finalized")))
      .returning({ id: meeting.id });
    if (!row) throw new UserError("Only a finalized meeting can be reopened.");
    await audit({ actorId: me.id, action: "meeting.reopen", entity: "meeting", entityId: meetingId, reason: why });
    refresh();
    return null;
  });
}

/** Visitors at the meeting (counted at the door by the LVH team; goes into PALMS). */
export async function setVisitorCount(input: { meetingId: string; count: number }): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertAnyCap(["kiosk.run", "meeting.finalize"]);
    const meetingId = z.uuid().parse(input.meetingId);
    const count = z.number().int().min(0).max(500).parse(input.count);
    const [row] = await db.update(meeting).set({ visitorCount: count }).where(eq(meeting.id, meetingId)).returning({ id: meeting.id });
    if (!row) throw new UserError("Meeting not found.");
    await audit({ actorId: me.id, action: "meeting.visitors", entity: "meeting", entityId: meetingId, after: { count } });
    refresh();
    return null;
  });
}

/** Attendance Coordinator ticks off absentee calls (24-hour follow-up). */
export async function saveFollowup(input: { meetingId: string; memberId: string; called: boolean; note?: string }): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertAnyCap(["palms.view", "meeting.finalize"]);
    const values = {
      calledById: input.called ? me.id : null,
      calledAt: input.called ? new Date() : null,
      note: input.note?.trim().slice(0, 300) || null,
    };
    await db
      .insert(absenceFollowup)
      .values({ meetingId: z.uuid().parse(input.meetingId), memberId: input.memberId, ...values })
      .onConflictDoUpdate({ target: [absenceFollowup.meetingId, absenceFollowup.memberId], set: values });
    await audit({
      actorId: me.id,
      action: "absence.followup",
      entity: "meeting",
      entityId: input.meetingId,
      after: { memberId: input.memberId, called: input.called },
    });
    refresh();
    return null;
  });
}
