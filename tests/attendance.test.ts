import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { jwkThumbprint, parsePublicJwk, verifyDeviceSignature } from "@/lib/attendance/device-crypto";
import { checkGeofence, haversineM } from "@/lib/attendance/geo";
import { buildPass, parsePass, signedPayload } from "@/lib/attendance/payloads";
import {
  newMeetingSecret,
  parseQrToken,
  QR_WINDOW_SECONDS,
  signQrToken,
  verifyQrToken,
  windowAt,
} from "@/lib/attendance/qr-token";
import { checkinWindow, lateCutoff, statusForCheckin } from "@/lib/attendance/rules";

const MEETING = "b460bf1a-4c36-4089-8561-1da595e2f14a";

describe("rotating venue QR token (T3, T6, T11)", () => {
  const secret = newMeetingSecret();
  const now = Date.UTC(2026, 9, 8, 1, 30, 7); // 07:00:07 IST
  const w = windowAt(now);

  it("accepts the current window", () => {
    const parsed = parseQrToken(signQrToken(MEETING, secret, w))!;
    expect(verifyQrToken(parsed, secret, now)).toBe("ok");
  });

  it("accepts the previous window (scan latency) but not older ones", () => {
    const prev = parseQrToken(signQrToken(MEETING, secret, w - 1))!;
    expect(verifyQrToken(prev, secret, now)).toBe("ok");
    const old = parseQrToken(signQrToken(MEETING, secret, w - 2))!;
    expect(verifyQrToken(old, secret, now)).toBe("expired");
  });

  it("is useless after at most 30 seconds (a forwarded screenshot)", () => {
    const token = parseQrToken(signQrToken(MEETING, secret, w))!;
    expect(verifyQrToken(token, secret, now + 2 * QR_WINDOW_SECONDS * 1000)).toBe("expired");
  });

  it("rejects future windows, other secrets and tampering", () => {
    const future = parseQrToken(signQrToken(MEETING, secret, w + 1))!;
    expect(verifyQrToken(future, secret, now)).toBe("invalid");
    const other = parseQrToken(signQrToken(MEETING, newMeetingSecret(), w))!;
    expect(verifyQrToken(other, secret, now)).toBe("invalid");
    const token = signQrToken(MEETING, secret, w);
    const tampered = parseQrToken(token.replace(`.${w}.`, `.${w - 1}.`))!;
    expect(verifyQrToken(tampered, secret, now)).toBe("invalid");
  });

  it("rejects malformed tokens", () => {
    expect(parseQrToken("https://example.com")).toBeNull();
    expect(parseQrToken(`BNID1.${MEETING}.abc.xxxxxxxxxxxxxxxxxxxxxx`)).toBeNull();
    expect(parseQrToken(`BNID2.${MEETING}.1.xxxxxxxxxxxxxxxxxxxxxx`)).toBeNull();
  });
});

describe("geofence (T4, T8, T9)", () => {
  const venue = { lat: 9.9195, lng: 78.1193 };

  it("computes distances in metres", () => {
    // ~111 m per 0.001 degree of latitude.
    expect(haversineM(venue, { lat: venue.lat + 0.001, lng: venue.lng })).toBeCloseTo(111.2, 0);
  });

  it("accepts inside the radius and rejects outside", () => {
    const base = { accuracyM: 10, radiusM: 150, allowanceM: 50, maxAccuracyM: 500 };
    expect(checkGeofence({ ...base, distanceM: 120 })).toBe("ok");
    expect(checkGeofence({ ...base, distanceM: 2400 })).toBe("too_far");
  });

  it("forgives reported inaccuracy only up to the allowance", () => {
    const base = { radiusM: 150, allowanceM: 50, maxAccuracyM: 500 };
    expect(checkGeofence({ ...base, distanceM: 190, accuracyM: 45 })).toBe("ok");
    // 300 m accuracy is capped at 50 m of slack: 260 - 50 > 150.
    expect(checkGeofence({ ...base, distanceM: 260, accuracyM: 300 })).toBe("too_far");
    // Strict mode.
    expect(checkGeofence({ ...base, allowanceM: 0, distanceM: 160, accuracyM: 40 })).toBe("too_far");
  });

  it("refuses very rough fixes (Precise Location off)", () => {
    expect(
      checkGeofence({ distanceM: 50, accuracyM: 3000, radiusM: 150, allowanceM: 50, maxAccuracyM: 500 }),
    ).toBe("poor_accuracy");
  });
});

describe("late rule (exact start time unless grace is set)", () => {
  const start = new Date("2026-10-08T01:30:00Z"); // 07:00 IST

  it("with no grace, 07:00:00 is on time and 07:00:01 is late", () => {
    expect(statusForCheckin(new Date(start.getTime()), start, null)).toBe("P");
    expect(statusForCheckin(new Date(start.getTime() + 1000), start, null)).toBe("L");
  });

  it("with grace, late only after start + grace", () => {
    expect(lateCutoff(start, 5).toISOString()).toBe("2026-10-08T01:35:00.000Z");
    expect(statusForCheckin(new Date(start.getTime() + 5 * 60_000), start, 5)).toBe("P");
    expect(statusForCheckin(new Date(start.getTime() + 5 * 60_000 + 1), start, 5)).toBe("L");
  });

  it("check-in window opens and closes on server time (T7)", () => {
    const opens = new Date(start.getTime() - 60 * 60_000);
    const ends = new Date(start.getTime() + 90 * 60_000);
    expect(checkinWindow(new Date(opens.getTime() - 1), opens, ends)).toBe("not_open_yet");
    expect(checkinWindow(start, opens, ends)).toBe("open");
    expect(checkinWindow(new Date(ends.getTime() + 1), opens, ends)).toBe("closed");
  });
});

describe("device key signatures (T1, T2, T10)", () => {
  async function phone() {
    const pair = (await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const jwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
    const sign = async (payload: string) =>
      Buffer.from(
        await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(payload)),
      ).toString("base64url");
    return { jwk: parsePublicJwk({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y })!, sign };
  }

  it("verifies a signature from the registered phone", async () => {
    const p = await phone();
    const payload = signedPayload.checkin("member-1", "BNID1.token");
    expect(await verifyDeviceSignature(p.jwk, payload, await p.sign(payload))).toBe(true);
  });

  it("rejects another phone's signature and a reused signature for another member", async () => {
    const mine = await phone();
    const other = await phone();
    const payload = signedPayload.checkin("member-1", "BNID1.token");
    expect(await verifyDeviceSignature(mine.jwk, payload, await other.sign(payload))).toBe(false);
    const sig = await mine.sign(payload);
    expect(await verifyDeviceSignature(mine.jwk, signedPayload.checkin("member-2", "BNID1.token"), sig)).toBe(false);
  });

  it("gives each key a stable, distinct thumbprint", async () => {
    const a = await phone();
    const b = await phone();
    expect(jwkThumbprint(a.jwk)).toBe(jwkThumbprint({ ...a.jwk }));
    expect(jwkThumbprint(a.jwk)).not.toBe(jwkThumbprint(b.jwk));
  });

  it("refuses JWKs carrying a private key or the wrong curve", () => {
    const x = "A".repeat(43);
    expect(parsePublicJwk({ kty: "EC", crv: "P-256", x, y: x, d: x })).toBeNull();
    expect(parsePublicJwk({ kty: "EC", crv: "P-384", x, y: x })).toBeNull();
    expect(parsePublicJwk({ kty: "RSA", n: "abc", e: "AQAB" })).toBeNull();
  });
});

describe("member pass (LVH fallback)", () => {
  it("round-trips through the QR text", () => {
    const sig = "s".repeat(86);
    const deviceId = "0f8fad5b-d9cb-469f-a165-70867728950e";
    const text = buildPass(MEETING, deviceId, 1791200000000, sig);
    expect(parsePass(text)).toEqual({ memberId: MEETING, deviceId, ts: 1791200000000, signature: sig });
    expect(parsePass(text.replace("BNIDP1", "BNIDP2"))).toBeNull();
  });
});
