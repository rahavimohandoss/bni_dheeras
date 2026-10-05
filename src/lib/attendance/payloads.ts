/**
 * Strings the phone signs with its device key. Shared by the browser (signing)
 * and the server (verifying), so it must not import Node-only modules.
 */
export const signedPayload = {
  register: (memberId: string, ts: number) => `bni-register|${memberId}|${ts}`,
  checkin: (memberId: string, qrToken: string) => `bni-checkin|${memberId}|${qrToken}`,
  pass: (memberId: string, deviceId: string, ts: number) => `bni-pass|${memberId}|${deviceId}|${ts}`,
};

/** Member pass QR (LVH fallback): BNIDP1.<memberId>.<deviceId>.<unixMs>.<signature> */
export const PASS_PREFIX = "BNIDP1";
export const PASS_ROTATE_MS = 30_000;
export const PASS_MAX_AGE_MS = 60_000;

export function buildPass(memberId: string, deviceId: string, ts: number, signature: string): string {
  return `${PASS_PREFIX}.${memberId}.${deviceId}.${ts}.${signature}`;
}

export function parsePass(
  value: string,
): { memberId: string; deviceId: string; ts: number; signature: string } | null {
  const parts = value.trim().split(".");
  if (parts.length !== 5 || parts[0] !== PASS_PREFIX) return null;
  const [, memberId, deviceId, tsStr, signature] = parts;
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(memberId) && !/^[A-Za-z0-9_-]{8,64}$/.test(memberId)) return null;
  if (!uuid.test(deviceId)) return null;
  if (!/^\d{12,14}$/.test(tsStr)) return null;
  if (!/^[A-Za-z0-9_-]{86}$/.test(signature)) return null;
  return { memberId, deviceId, ts: Number(tsStr), signature };
}
