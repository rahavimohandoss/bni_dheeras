import type { AttendanceStatus } from "@/db/schema";

/**
 * On time means checked in at or before start + grace. With no grace set
 * (null), the exact start time is the cut-off: 07:00:00 is on time and
 * 07:00:01 is late.
 */
export function lateCutoff(startsAt: Date, graceMinutes: number | null): Date {
  return new Date(startsAt.getTime() + (graceMinutes ?? 0) * 60_000);
}

export function statusForCheckin(
  checkedInAt: Date,
  startsAt: Date,
  graceMinutes: number | null,
): Extract<AttendanceStatus, "P" | "L"> {
  return checkedInAt.getTime() > lateCutoff(startsAt, graceMinutes).getTime() ? "L" : "P";
}

export type WindowVerdict = "open" | "not_open_yet" | "closed";

export function checkinWindow(now: Date, opensAt: Date, endsAt: Date): WindowVerdict {
  if (now.getTime() < opensAt.getTime()) return "not_open_yet";
  if (now.getTime() > endsAt.getTime()) return "closed";
  return "open";
}

export const STATUS_LABELS: Record<AttendanceStatus, string> = {
  P: "Present",
  L: "Late",
  A: "Absent",
  M: "Medical",
  S: "Substitute",
};

/** Human messages for check-in rejection reasons (shown to members and LVH). */
export const REJECTION_MESSAGES: Record<string, string> = {
  bad_qr: "That isn't a BNI Dheeras check-in QR. Scan the code on the venue screen.",
  qr_expired: "This QR has expired. Scan the screen again (it changes every 15 seconds).",
  qr_invalid: "This QR isn't valid. Scan the code on the venue screen.",
  meeting_not_found: "This meeting wasn't found.",
  meeting_closed: "This meeting is closed for check-in.",
  not_open_yet: "Check-in isn't open yet.",
  window_closed: "Check-in for this meeting has closed. Please see the LVH team.",
  no_device: "This phone isn't registered. Register it from your Home screen first.",
  device_pending: "This phone is waiting for approval. Show your approval code to the Attendance Coordinator.",
  device_revoked: "This phone's registration was removed. Register again and get it approved.",
  device_other_member: "This phone is registered to another member. Each member must use their own phone.",
  bad_signature: "This phone couldn't prove its identity. Re-open the app and try again.",
  rate_limited: "Too many attempts. Wait a few minutes and try again, or see the LVH team.",
  already: "You're already checked in.",
  inactive: "Your membership is not active.",
  pass_expired: "This pass has expired. Ask the member to refresh it.",
  pass_invalid: "This isn't a valid member pass.",
};
