import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * The venue QR is a short-lived token, not a URL:
 *
 *   BNID1.<meetingId>.<window>.<mac>
 *
 * window = floor(unixSeconds / 15). mac = HMAC-SHA256(meeting secret,
 * "<meetingId>.<window>") truncated to 128 bits. The server accepts the current
 * window and the previous one, so a token is valid for at most 30 seconds.
 */
export const QR_WINDOW_SECONDS = 15;
export const QR_ACCEPTED_WINDOWS = 2;
const PREFIX = "BNID1";

export function newMeetingSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function windowAt(ms: number): number {
  return Math.floor(ms / 1000 / QR_WINDOW_SECONDS);
}

function mac(secret: string, meetingId: string, window: number): string {
  return createHmac("sha256", secret)
    .update(`${meetingId}.${window}`)
    .digest()
    .subarray(0, 16)
    .toString("base64url");
}

export function signQrToken(meetingId: string, secret: string, window: number): string {
  return `${PREFIX}.${meetingId}.${window}.${mac(secret, meetingId, window)}`;
}

export type ParsedQrToken = { meetingId: string; window: number; mac: string };

export function parseQrToken(token: string): ParsedQrToken | null {
  const parts = token.trim().split(".");
  if (parts.length !== 4 || parts[0] !== PREFIX) return null;
  const [, meetingId, windowStr, tokenMac] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(meetingId)) return null;
  if (!/^\d{1,12}$/.test(windowStr)) return null;
  if (!/^[A-Za-z0-9_-]{22}$/.test(tokenMac)) return null;
  return { meetingId, window: Number(windowStr), mac: tokenMac };
}

export type QrVerdict = "ok" | "expired" | "invalid";

/** Checks the MAC and that the token's window is current or just-previous. */
export function verifyQrToken(parsed: ParsedQrToken, secret: string, nowMs: number): QrVerdict {
  const expected = Buffer.from(mac(secret, parsed.meetingId, parsed.window));
  const given = Buffer.from(parsed.mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";
  const current = windowAt(nowMs);
  const age = current - parsed.window;
  if (age < 0 || age >= QR_ACCEPTED_WINDOWS) return age < 0 ? "invalid" : "expired";
  return "ok";
}

/** Milliseconds until the current window ends (for the kiosk countdown). */
export function msUntilNextWindow(nowMs: number): number {
  const windowMs = QR_WINDOW_SECONDS * 1000;
  return windowMs - (nowMs % windowMs);
}
