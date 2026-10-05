import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { and, eq, gte, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db";
import { auditLog, kiosk, kioskPairingCode } from "@/db/schema";
import { audit } from "@/lib/audit";
import { getCurrentMember } from "@/lib/session";

/**
 * A kiosk is a screen at the venue (projector laptop, TV, tablet) that shows
 * the rotating QR. It is paired once with a 6-digit code from an LVH member and
 * then holds a long-lived httpOnly cookie. It can only display, nothing else.
 */
export const KIOSK_COOKIE = "bni_kiosk";
const PAIRING_TTL_MS = 10 * 60_000;

const hash = (value: string) =>
  createHash("sha256")
    .update(`${process.env.BETTER_AUTH_SECRET ?? "dev"}|${value}`)
    .digest("base64url");

export async function createPairingCode(actorId: string, label: string): Promise<string> {
  const code = String(randomInt(100000, 1_000_000));
  await db.insert(kioskPairingCode).values({
    codeHash: hash(`pair:${code}`),
    label,
    expiresAt: new Date(Date.now() + PAIRING_TTL_MS),
    createdById: actorId,
  });
  await audit({ actorId, action: "kiosk.pairing_code", entity: "kiosk", after: { label } });
  return code;
}

/** Too many wrong pairing codes recently: lock pairing for a while. */
async function pairingLocked(): Promise<boolean> {
  const since = new Date(Date.now() - 10 * 60_000);
  const rows = await db
    .select({ id: auditLog.id })
    .from(auditLog)
    .where(and(eq(auditLog.action, "kiosk.pair_failed"), gte(auditLog.at, since)))
    .limit(20);
  return rows.length >= 20;
}

export async function pairWithCode(code: string): Promise<{ ok: true; label: string } | { ok: false; error: string }> {
  if (await pairingLocked()) return { ok: false, error: "Too many wrong codes. Wait 10 minutes." };
  const [row] = await db
    .select()
    .from(kioskPairingCode)
    .where(
      and(
        eq(kioskPairingCode.codeHash, hash(`pair:${code.trim()}`)),
        isNull(kioskPairingCode.usedAt),
        gte(kioskPairingCode.expiresAt, new Date()),
      ),
    );
  if (!row) {
    await audit({ actorId: null, action: "kiosk.pair_failed", entity: "kiosk" });
    return { ok: false, error: "That code is wrong or has expired." };
  }
  const token = randomBytes(32).toString("base64url");
  await db.update(kioskPairingCode).set({ usedAt: new Date() }).where(eq(kioskPairingCode.id, row.id));
  const [k] = await db
    .insert(kiosk)
    .values({ label: row.label, tokenHash: hash(`kiosk:${token}`), createdById: row.createdById })
    .returning();
  (await cookies()).set(KIOSK_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  await audit({ actorId: row.createdById, action: "kiosk.paired", entity: "kiosk", entityId: k.id, after: { label: k.label } });
  return { ok: true, label: k.label };
}

export async function getPairedKiosk() {
  const token = (await cookies()).get(KIOSK_COOKIE)?.value;
  if (!token) return null;
  const [k] = await db
    .select()
    .from(kiosk)
    .where(and(eq(kiosk.tokenHash, hash(`kiosk:${token}`)), isNull(kiosk.revokedAt)));
  if (!k) return null;
  if (!k.lastSeenAt || Date.now() - k.lastSeenAt.getTime() > 5 * 60_000) {
    await db.update(kiosk).set({ lastSeenAt: new Date() }).where(eq(kiosk.id, k.id));
  }
  return k;
}

/** A paired kiosk, or a signed-in member who can run the kiosk. */
export async function kioskAccess(): Promise<{ kind: "kiosk"; id: string } | { kind: "member"; id: string } | null> {
  const me = await getCurrentMember();
  if (me?.caps.has("kiosk.run")) return { kind: "member", id: me.id };
  const k = await getPairedKiosk();
  return k ? { kind: "kiosk", id: k.id } : null;
}
