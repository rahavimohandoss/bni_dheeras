"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { leaveRequest, member, substitute } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { getMeetingWithVenue } from "@/lib/attendance/queries";
import { audit } from "@/lib/audit";
import { normalizePhone } from "@/lib/members";
import { membersWithRoles, notify } from "@/lib/notify";
import { assertCap, assertMember } from "@/lib/session";
import { formatDate } from "@/lib/time";

/** Members can change their own plans only until the meeting starts. */
async function openMeetingForMember(meetingId: string) {
  const m = await getMeetingWithVenue(meetingId);
  if (!m || m.status !== "scheduled") throw new UserError("This meeting isn't open.");
  if (Date.now() >= m.startsAt.getTime()) {
    throw new UserError("The meeting has started. Please speak to the LVH team or the Secretary.");
  }
  return m;
}

const leaveSchema = z.object({
  meetingId: z.uuid(),
  kind: z.enum(["medical", "informed"]),
  reason: z.string().trim().max(300).optional(),
});

export async function requestLeave(input: z.input<typeof leaveSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    if (!me.isChapterMember) throw new UserError("This is an admin account, not a chapter member.");
    const data = leaveSchema.parse(input);
    const m = await openMeetingForMember(data.meetingId);
    const status = data.kind === "informed" ? "approved" : "pending";
    await db
      .insert(leaveRequest)
      .values({ meetingId: m.id, memberId: me.id, kind: data.kind, reason: data.reason, status })
      .onConflictDoUpdate({
        target: [leaveRequest.meetingId, leaveRequest.memberId],
        set: { kind: data.kind, reason: data.reason, status, decidedAt: null, decidedById: null },
      });
    await audit({ actorId: me.id, action: `leave.${data.kind}`, entity: "meeting", entityId: m.id, reason: data.reason });
    if (data.kind === "medical") {
      const approvers = await membersWithRoles(["attendance_coordinator", "secretary_treasurer"]);
      await notify(approvers, {
        title: `Medical leave request: ${me.fullName}`,
        body: `${m.title}, ${formatDate(m.startsAt)}${data.reason ? ` — ${data.reason}` : ""}`,
        link: "/admin/leave",
      });
    }
    refresh();
    return null;
  });
}

const subSchema = z.object({
  meetingId: z.uuid(),
  name: z.string().trim().min(2, "Enter the substitute's name").max(120),
  phone: z.string().trim().min(8, "Enter a phone number").max(20),
  business: z.string().trim().max(160).optional(),
});

export async function registerSubstitute(input: z.input<typeof subSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    if (!me.isChapterMember) throw new UserError("This is an admin account, not a chapter member.");
    const data = subSchema.parse(input);
    const m = await openMeetingForMember(data.meetingId);
    const phone = normalizePhone(data.phone)!;
    await db
      .insert(substitute)
      .values({ meetingId: m.id, memberId: me.id, name: data.name, phone, business: data.business })
      .onConflictDoUpdate({
        target: [substitute.meetingId, substitute.memberId],
        set: { name: data.name, phone, business: data.business, arrivedAt: null, confirmedById: null },
      });
    await audit({ actorId: me.id, action: "substitute.register", entity: "meeting", entityId: m.id, after: { name: data.name } });
    const team = await membersWithRoles(["vice_president", "lvh_captain", "lvh"]);
    await notify(team, {
      title: `Substitute for ${me.fullName}: ${data.name}`,
      body: `${m.title}, ${formatDate(m.startsAt)}. Confirm at the door when they arrive.`,
    });
    refresh();
    return null;
  });
}

export async function cancelPlan(meetingId: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    const m = await openMeetingForMember(z.uuid().parse(meetingId));
    await db.delete(leaveRequest).where(and(eq(leaveRequest.meetingId, m.id), eq(leaveRequest.memberId, me.id)));
    await db.delete(substitute).where(and(eq(substitute.meetingId, m.id), eq(substitute.memberId, me.id)));
    await audit({ actorId: me.id, action: "leave.cancel", entity: "meeting", entityId: m.id });
    refresh();
    return null;
  });
}

export async function decideLeave(id: string, approve: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("leave.approve");
    const [current] = await db.select().from(leaveRequest).where(eq(leaveRequest.id, z.uuid().parse(id)));
    if (!current) throw new UserError("Request not found.");
    if (current.memberId === me.id && !me.fullAccess) throw new UserError("Someone else must decide your own leave.");
    const [row] = await db
      .update(leaveRequest)
      .set({ status: approve ? "approved" : "rejected", decidedById: me.id, decidedAt: new Date() })
      .where(eq(leaveRequest.id, current.id))
      .returning();
    const [who] = await db.select({ fullName: member.fullName }).from(member).where(eq(member.id, row.memberId));
    await audit({
      actorId: me.id,
      action: approve ? "leave.approve" : "leave.reject",
      entity: "leave_request",
      entityId: row.id,
      after: { member: who?.fullName },
    });
    await notify([row.memberId], {
      title: approve ? "Medical leave approved" : "Medical leave not approved",
      body: approve
        ? "You'll be marked M (medical) for this meeting."
        : "Please attend, send a substitute, or speak to the Attendance Coordinator.",
      link: "/",
    });
    refresh();
    return null;
  });
}
