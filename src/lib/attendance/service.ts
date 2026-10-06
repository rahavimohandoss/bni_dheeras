import "server-only";
import { and, eq, gte, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  attendance,
  type AttendanceStatus,
  checkinAttempt,
  device,
  leaveRequest,
  meeting,
  member,
  substitute,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { isUniqueViolation } from "@/lib/db-errors";
import { membersWithRoles, notify } from "@/lib/notify";
import { getAttendanceSettings } from "@/lib/settings";
import { formatDate } from "@/lib/time";
import { parsePublicJwk, verifyDeviceSignature } from "./device-crypto";
import { PASS_MAX_AGE_MS, parsePass, signedPayload } from "./payloads";
import { parseQrToken, verifyQrToken } from "./qr-token";
import { absenceCounts, expectedMembers, getMeetingWithVenue, lateCounts, type MeetingWithVenue } from "./queries";
import { checkinWindow, statusForCheckin } from "./rules";

export type RequestMeta = { ip: string | null; userAgent: string | null };

export type CheckinResult =
  | {
      ok: true;
      status: "P" | "L";
      checkedInAt: string;
      meetingTitle: string;
      memberName: string;
      already: boolean;
    }
  | { ok: false; reason: string; memberName?: string };

const ATTEMPT_WINDOW_MS = 5 * 60_000;
const MAX_ATTEMPTS = 10;
const BURST_WINDOW_MS = 20_000;

type AttemptLog = {
  meetingId?: string | null;
  memberId?: string | null;
  deviceId?: string | null;
  via: "self_qr" | "lvh_scan";
  meta: RequestMeta;
};

async function logAttempt(base: AttemptLog, result: "ok" | "rejected", reason: string) {
  await db.insert(checkinAttempt).values({
    meetingId: base.meetingId ?? null,
    memberId: base.memberId ?? null,
    deviceId: base.deviceId ?? null,
    via: base.via,
    result,
    reason,
    ip: base.meta.ip,
    userAgent: base.meta.userAgent?.slice(0, 300) ?? null,
  });
}

async function tooManyAttempts(memberId: string, now: Date): Promise<boolean> {
  const rows = await db
    .select({ id: checkinAttempt.id })
    .from(checkinAttempt)
    .where(
      and(
        eq(checkinAttempt.memberId, memberId),
        gte(checkinAttempt.at, new Date(now.getTime() - ATTEMPT_WINDOW_MS)),
      ),
    )
    .limit(MAX_ATTEMPTS);
  return rows.length >= MAX_ATTEMPTS;
}

/** Meeting must be open: scheduled, and now inside its check-in window. */
function meetingGate(m: MeetingWithVenue | null, now: Date): string | null {
  if (!m) return "meeting_not_found";
  if (m.status !== "scheduled") return "meeting_closed";
  const w = checkinWindow(now, m.checkinOpensAt, m.endsAt);
  if (w === "not_open_yet") return "not_open_yet";
  if (w === "closed") return "window_closed";
  return null;
}

/** Another member checked in seconds ago from the same network and browser. */
async function burstFlag(meetingId: string, memberId: string, meta: RequestMeta, now: Date) {
  if (!meta.ip || !meta.userAgent) return [];
  const rows = await db
    .select({ id: checkinAttempt.id })
    .from(checkinAttempt)
    .where(
      and(
        eq(checkinAttempt.meetingId, meetingId),
        eq(checkinAttempt.result, "ok"),
        eq(checkinAttempt.ip, meta.ip),
        eq(checkinAttempt.userAgent, meta.userAgent.slice(0, 300)),
        ne(checkinAttempt.memberId, memberId),
        gte(checkinAttempt.at, new Date(now.getTime() - BURST_WINDOW_MS)),
      ),
    )
    .limit(1);
  return rows.length > 0 ? ["same_phone_burst"] : [];
}

type WriteCheckin = {
  m: MeetingWithVenue;
  memberId: string;
  memberName: string;
  method: "self_qr" | "lvh_scan";
  deviceId: string;
  flags: string[];
  setById: string | null;
  now: Date;
};

async function writeCheckin(w: WriteCheckin): Promise<CheckinResult> {
  const [existing] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.meetingId, w.m.id), eq(attendance.memberId, w.memberId)));
  if (existing && (existing.status === "P" || existing.status === "L")) {
    return {
      ok: true,
      already: true,
      status: existing.status,
      checkedInAt: (existing.checkedInAt ?? existing.createdAt).toISOString(),
      meetingTitle: w.m.title,
      memberName: w.memberName,
    };
  }
  if (existing && existing.status !== "S") {
    return { ok: false, reason: "already", memberName: w.memberName };
  }
  const status = statusForCheckin(w.now, w.m.startsAt, w.m.graceMinutes);
  const values = {
    status,
    method: w.method,
    checkedInAt: w.now,
    deviceId: w.deviceId,
    flags: w.flags,
    setById: w.setById,
  } as const;
  try {
    if (existing) {
      // The member registered a substitute but came in person after all.
      await db
        .update(attendance)
        .set({ ...values, note: "Came in person (a substitute was registered)" })
        .where(and(eq(attendance.meetingId, w.m.id), eq(attendance.memberId, w.memberId)));
    } else {
      await db.insert(attendance).values({ meetingId: w.m.id, memberId: w.memberId, ...values });
    }
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    // Double tap, or this device was already used for this meeting.
    const [row] = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.meetingId, w.m.id), eq(attendance.memberId, w.memberId)));
    if (row && (row.status === "P" || row.status === "L")) {
      return {
        ok: true,
        already: true,
        status: row.status,
        checkedInAt: (row.checkedInAt ?? row.createdAt).toISOString(),
        meetingTitle: w.m.title,
        memberName: w.memberName,
      };
    }
    return { ok: false, reason: "device_other_member", memberName: w.memberName };
  }
  await db.update(device).set({ lastUsedAt: w.now }).where(eq(device.id, w.deviceId));
  return {
    ok: true,
    already: false,
    status,
    checkedInAt: w.now.toISOString(),
    meetingTitle: w.m.title,
    memberName: w.memberName,
  };
}

/**
 * A member scanned the venue QR on their own phone. All six checks run here:
 * session (caller), device signature, fresh QR, time, once per member, once
 * per device. There's no location check (the geofence was removed).
 */
export async function selfCheckin(input: {
  memberId: string;
  memberName: string;
  qrToken: string;
  thumbprint: string;
  signature: string;
  meta: RequestMeta;
}): Promise<CheckinResult> {
  const now = new Date();
  const log: AttemptLog = { memberId: input.memberId, via: "self_qr", meta: input.meta };
  const reject = async (reason: string) => {
    await logAttempt(log, "rejected", reason);
    return { ok: false as const, reason };
  };

  if (await tooManyAttempts(input.memberId, now)) return reject("rate_limited");

  const parsed = parseQrToken(input.qrToken);
  if (!parsed) return reject("bad_qr");
  const m = await getMeetingWithVenue(parsed.meetingId);
  if (!m) return reject("meeting_not_found");
  log.meetingId = m.id;

  const qr = verifyQrToken(parsed, m.qrSecret, now.getTime());
  if (qr !== "ok") return reject(qr === "expired" ? "qr_expired" : "qr_invalid");

  const gate = meetingGate(m, now);
  if (gate) return reject(gate);

  const [dev] = await db.select().from(device).where(eq(device.keyThumbprint, input.thumbprint));
  if (!dev) return reject("no_device");
  log.deviceId = dev.id;
  if (dev.memberId !== input.memberId) return reject("device_other_member");
  if (dev.status === "pending") return reject("device_pending");
  if (dev.status === "revoked") return reject("device_revoked");
  const jwk = parsePublicJwk(dev.publicKeyJwk);
  const sigOk =
    jwk && (await verifyDeviceSignature(jwk, signedPayload.checkin(input.memberId, input.qrToken), input.signature));
  if (!sigOk) return reject("bad_signature");

  const result = await writeCheckin({
    m,
    memberId: input.memberId,
    memberName: input.memberName,
    method: "self_qr",
    deviceId: dev.id,
    flags: await burstFlag(m.id, input.memberId, input.meta, now),
    setById: null,
    now,
  });
  await logAttempt(
    log,
    result.ok ? "ok" : "rejected",
    result.ok ? (result.already ? "already" : "checked_in") : result.reason,
  );
  return result;
}

/**
 * Fallback 1: an LVH member scans the member's "check-in pass" (a QR signed by
 * the member's approved phone).
 */
export async function passCheckin(input: {
  lvhId: string;
  meetingId: string;
  pass: string;
  meta: RequestMeta;
}): Promise<CheckinResult> {
  const now = new Date();
  const log: AttemptLog = { meetingId: input.meetingId, via: "lvh_scan", meta: input.meta };
  const reject = async (reason: string, memberName?: string) => {
    await logAttempt(log, "rejected", reason);
    return { ok: false as const, reason, memberName };
  };

  const pass = parsePass(input.pass);
  if (!pass) return reject("pass_invalid");
  log.memberId = pass.memberId;
  log.deviceId = pass.deviceId;
  const age = now.getTime() - pass.ts;
  if (age > PASS_MAX_AGE_MS || age < -30_000) return reject("pass_expired");

  const [who] = await db
    .select({ id: member.id, fullName: member.fullName, status: member.status })
    .from(member)
    .where(eq(member.id, pass.memberId));
  if (!who) return reject("pass_invalid");
  if (who.status !== "active") return reject("inactive", who.fullName);

  const [dev] = await db.select().from(device).where(eq(device.id, pass.deviceId));
  if (!dev || dev.memberId !== who.id) return reject("pass_invalid", who.fullName);
  if (dev.status !== "approved") {
    return reject(dev.status === "pending" ? "device_pending" : "device_revoked", who.fullName);
  }
  const jwk = parsePublicJwk(dev.publicKeyJwk);
  const sigOk =
    jwk && (await verifyDeviceSignature(jwk, signedPayload.pass(who.id, dev.id, pass.ts), pass.signature));
  if (!sigOk) return reject("pass_invalid", who.fullName);

  const m = await getMeetingWithVenue(input.meetingId);
  const gate = meetingGate(m, now);
  if (gate || !m) return reject(gate ?? "meeting_not_found", who.fullName);

  const result = await writeCheckin({
    m,
    memberId: who.id,
    memberName: who.fullName,
    method: "lvh_scan",
    deviceId: dev.id,
    flags: [],
    setById: input.lvhId,
    now,
  });
  await logAttempt(
    log,
    result.ok ? "ok" : "rejected",
    result.ok ? (result.already ? "already" : "checked_in") : result.reason,
  );
  if (result.ok && !result.already) {
    await audit({
      actorId: input.lvhId,
      action: "attendance.pass_scan",
      entity: "attendance",
      entityId: `${m.id}:${who.id}`,
      after: { status: result.status },
    });
  }
  return result;
}

export class AttendanceError extends Error {}

async function requireOpenMeeting(meetingId: string) {
  const m = await getMeetingWithVenue(meetingId);
  if (!m) throw new AttendanceError("Meeting not found.");
  if (m.status !== "scheduled") throw new AttendanceError("This meeting is finalized or cancelled.");
  return m;
}

/** Fallback 2: LVH marks a member present or late by hand. Reason required. */
export async function manualCheckin(input: {
  actorId: string;
  meetingId: string;
  memberId: string;
  status: "P" | "L";
  reason: string;
}) {
  await requireOpenMeeting(input.meetingId);
  const now = new Date();
  const [before] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.meetingId, input.meetingId), eq(attendance.memberId, input.memberId)));
  const values = {
    status: input.status,
    method: "manual" as const,
    checkedInAt: before?.checkedInAt ?? now,
    note: input.reason,
    setById: input.actorId,
  };
  if (before) {
    await db
      .update(attendance)
      .set(values)
      .where(and(eq(attendance.meetingId, input.meetingId), eq(attendance.memberId, input.memberId)));
  } else {
    await db.insert(attendance).values({ meetingId: input.meetingId, memberId: input.memberId, ...values });
  }
  await audit({
    actorId: input.actorId,
    action: before ? "attendance.manual_update" : "attendance.manual_checkin",
    entity: "attendance",
    entityId: `${input.meetingId}:${input.memberId}`,
    before: before ? { status: before.status, method: before.method } : null,
    after: { status: input.status },
    reason: input.reason,
  });
}

/** Undo a wrong check-in before the meeting is finalized. */
export async function removeCheckin(input: { actorId: string; meetingId: string; memberId: string; reason: string }) {
  await requireOpenMeeting(input.meetingId);
  const [before] = await db
    .delete(attendance)
    .where(and(eq(attendance.meetingId, input.meetingId), eq(attendance.memberId, input.memberId)))
    .returning();
  if (!before) return;
  await audit({
    actorId: input.actorId,
    action: "attendance.remove",
    entity: "attendance",
    entityId: `${input.meetingId}:${input.memberId}`,
    before: { status: before.status, method: before.method, checkedInAt: before.checkedInAt },
    reason: input.reason,
  });
}

/** LVH confirms the registered substitute arrived: the member becomes S. */
export async function confirmSubstitute(input: { actorId: string; meetingId: string; memberId: string }) {
  await requireOpenMeeting(input.meetingId);
  const now = new Date();
  const [sub] = await db
    .update(substitute)
    .set({ arrivedAt: now, confirmedById: input.actorId })
    .where(and(eq(substitute.meetingId, input.meetingId), eq(substitute.memberId, input.memberId)))
    .returning();
  if (!sub) throw new AttendanceError("No substitute is registered for this member.");
  const [existing] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.meetingId, input.meetingId), eq(attendance.memberId, input.memberId)));
  if (!existing) {
    await db.insert(attendance).values({
      meetingId: input.meetingId,
      memberId: input.memberId,
      status: "S",
      method: "substitute",
      checkedInAt: now,
      note: `Substitute: ${sub.name}`,
      setById: input.actorId,
    });
  }
  await audit({
    actorId: input.actorId,
    action: "substitute.confirm",
    entity: "substitute",
    entityId: sub.id,
    after: { name: sub.name },
  });
}

/**
 * Closes a meeting: everyone expected without a record becomes A, or M when
 * approved medical leave exists. Locks the meeting. Runs in one transaction.
 */
export async function finalizeMeeting(input: { actorId: string; meetingId: string; headcount: number | null }) {
  const result = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(meeting).where(eq(meeting.id, input.meetingId)).for("update");
    if (!locked) throw new AttendanceError("Meeting not found.");
    if (locked.status !== "scheduled") throw new AttendanceError("This meeting is already finalized or cancelled.");

    const expected = await expectedMembers(locked.startsAt, tx);
    const rows = await tx.select().from(attendance).where(eq(attendance.meetingId, locked.id));
    const have = new Set(rows.map((r) => r.memberId));
    const leaves = await tx
      .select()
      .from(leaveRequest)
      .where(and(eq(leaveRequest.meetingId, locked.id), eq(leaveRequest.status, "approved")));
    const medical = new Set(leaves.filter((l) => l.kind === "medical").map((l) => l.memberId));

    const now = new Date();
    const missing = expected.filter((e) => !have.has(e.id));
    const inserts = missing.map((e) => ({
      meetingId: locked.id,
      memberId: e.id,
      status: (medical.has(e.id) ? "M" : "A") as AttendanceStatus,
      method: "auto" as const,
      setById: input.actorId,
    }));
    if (inserts.length) await tx.insert(attendance).values(inserts);
    await tx
      .update(meeting)
      .set({ status: "finalized", headcount: input.headcount, finalizedAt: now, finalizedById: input.actorId })
      .where(eq(meeting.id, locked.id));
    await audit(
      {
        actorId: input.actorId,
        action: "meeting.finalize",
        entity: "meeting",
        entityId: locked.id,
        after: {
          headcount: input.headcount,
          checkedIn: rows.filter((r) => r.status === "P" || r.status === "L").length,
          absent: inserts.filter((i) => i.status === "A").length,
          medical: inserts.filter((i) => i.status === "M").length,
        },
      },
      tx,
    );
    return { meeting: locked, absentIds: inserts.filter((i) => i.status === "A").map((i) => i.memberId) };
  });

  await sendFinalizeAlerts(result.meeting.id, result.meeting.startsAt, result.absentIds).catch((e) =>
    console.error("[attendance] finalize alerts failed", e),
  );
  return result;
}

/** 2nd absence: warn member + Attendance Coordinator. Limit reached: Membership Committee. */
async function sendFinalizeAlerts(meetingId: string, startsAt: Date, absentIds: string[]) {
  const settings = await getAttendanceSettings();
  const coordinators = await membersWithRoles(["attendance_coordinator"]);

  if (absentIds.length) {
    const counts = await absenceCounts(absentIds, settings.absenceWindowMonths);
    const names = new Map(
      (
        await db
          .select({ id: member.id, fullName: member.fullName })
          .from(member)
          .where(inArray(member.id, absentIds))
      ).map((r) => [r.id, r.fullName]),
    );
    // Reaching the limit goes to the Head Table, who take it to the Membership Committee.
    const committee = await membersWithRoles(["president", "vice_president", "secretary_treasurer"]);
    for (const id of absentIds) {
      const n = counts.get(id) ?? 0;
      const who = names.get(id) ?? "A member";
      const window = `${settings.absenceWindowMonths} months`;
      if (n === settings.absenceLimit - 1) {
        await notify(
          [id],
          {
            title: `Attendance: ${n} absences in ${window}`,
            body: `You were marked absent on ${formatDate(startsAt)}. One more absence reaches the chapter limit of ${settings.absenceLimit}. Send a substitute if you can't attend.`,
            link: "/",
          },
          { email: true },
        );
        await notify(coordinators, {
          title: `${who}: ${n} absences in ${window}`,
          body: "Second-absence warning. Please call within 24 hours.",
          link: `/meetings/${meetingId}/summary`,
        });
      } else if (n >= settings.absenceLimit) {
        await notify([...committee, ...coordinators], {
          title: `${who} has reached ${n} absences in ${window}`,
          body: "Attendance limit reached. Membership Committee review needed.",
          link: `/meetings/${meetingId}/summary`,
        });
      }
    }
  }

  const present = await db
    .select({ memberId: attendance.memberId })
    .from(attendance)
    .where(and(eq(attendance.meetingId, meetingId), eq(attendance.status, "L")));
  if (present.length) {
    const lates = await lateCounts(
      present.map((p) => p.memberId),
      settings.lateFlagWeeks,
    );
    const flagged = [...lates.entries()].filter(([, n]) => n >= settings.lateFlagCount);
    if (flagged.length) {
      const names = await db
        .select({ id: member.id, fullName: member.fullName })
        .from(member)
        .where(
          inArray(
            member.id,
            flagged.map(([id]) => id),
          ),
        );
      await notify(coordinators, {
        title: "Repeated lateness",
        body: names
          .map((n) => `${n.fullName}: ${lates.get(n.id)} late in ${settings.lateFlagWeeks} weeks`)
          .join("\n"),
        link: `/meetings/${meetingId}/summary`,
      });
    }
  }
}
