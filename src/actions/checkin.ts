"use server";

import { z } from "zod";
import { type CheckinResult, passCheckin, selfCheckin } from "@/lib/attendance/service";
import { requestMeta } from "@/lib/request-meta";
import { assertCap, assertMember } from "@/lib/session";

const geoSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(100_000),
  })
  .nullable();

const checkinSchema = z.object({
  qrToken: z.string().min(10).max(200),
  thumbprint: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
  geo: geoSchema,
});

/** Member scanned the venue QR on their own phone. */
export async function checkIn(input: z.input<typeof checkinSchema>): Promise<CheckinResult> {
  let me;
  try {
    me = await assertMember();
  } catch {
    return { ok: false, reason: "inactive" };
  }
  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "bad_qr" };
  return selfCheckin({
    memberId: me.id,
    memberName: me.fullName,
    qrToken: parsed.data.qrToken,
    thumbprint: parsed.data.thumbprint,
    signature: parsed.data.signature,
    geo: parsed.data.geo,
    meta: await requestMeta(),
  });
}

const passSchema = z.object({
  meetingId: z.uuid(),
  pass: z.string().min(20).max(400),
  geo: geoSchema,
});

/** LVH fallback: scan a member's device-signed check-in pass. */
export async function scanMemberPass(input: z.input<typeof passSchema>): Promise<CheckinResult> {
  let lvh;
  try {
    lvh = await assertCap("attendance.manual");
  } catch {
    return { ok: false, reason: "inactive" };
  }
  const parsed = passSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: "pass_invalid" };
  return passCheckin({
    lvhId: lvh.id,
    meetingId: parsed.data.meetingId,
    pass: parsed.data.pass,
    geo: parsed.data.geo,
    meta: await requestMeta(),
  });
}
