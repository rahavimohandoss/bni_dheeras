"use server";

import { randomInt } from "node:crypto";
import { and, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { device } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { jwkThumbprint, parsePublicJwk, verifyDeviceSignature } from "@/lib/attendance/device-crypto";
import { signedPayload } from "@/lib/attendance/payloads";
import { audit } from "@/lib/audit";
import { membersWithRoles, notify } from "@/lib/notify";
import { requestMeta } from "@/lib/request-meta";
import { assertCap, assertMember } from "@/lib/session";

const registerSchema = z.object({
  jwk: z.unknown(),
  ts: z.number().int(),
  signature: z.string().regex(/^[A-Za-z0-9_-]{86}$/),
  label: z.string().trim().min(1).max(80),
});

const newCode = () => String(randomInt(1000, 10000));

export type DeviceRegistration = { status: "pending" | "approved"; approvalCode: string; deviceId: string };

/**
 * Registers this phone's public key for the signed-in member. The phone proves
 * it holds the private key by signing a timestamped payload. A key that is
 * already bound to another member is refused (one phone, one member).
 */
export async function registerDevice(input: z.input<typeof registerSchema>): Promise<ActionResult<DeviceRegistration>> {
  return runAction(async () => {
    const me = await assertMember();
    const data = registerSchema.parse(input);
    const jwk = parsePublicJwk(data.jwk);
    if (!jwk) throw new UserError("This phone's key is not valid. Reload the app and try again.");
    if (Math.abs(Date.now() - data.ts) > 5 * 60_000) {
      throw new UserError("Your phone's clock is far off. Set automatic date & time and try again.");
    }
    const ok = await verifyDeviceSignature(jwk, signedPayload.register(me.id, data.ts), data.signature);
    if (!ok) throw new UserError("This phone couldn't prove its key. Reload the app and try again.");

    const thumbprint = jwkThumbprint(jwk);
    const [existing] = await db.select().from(device).where(eq(device.keyThumbprint, thumbprint));
    const meta = await requestMeta();

    if (existing && existing.memberId !== me.id) {
      await audit({
        actorId: me.id,
        action: "device.register_blocked",
        entity: "device",
        entityId: existing.id,
        after: { reason: "key belongs to another member", label: data.label },
      });
      const owners = await membersWithRoles(["attendance_coordinator"]);
      await notify(owners, {
        title: `Blocked: ${me.fullName} tried to register another member's phone`,
        body: `${data.label}. One phone can belong to only one member.`,
        link: "/admin/devices",
      });
      throw new UserError(
        "This phone is already registered to another member. Each member must use their own phone.",
      );
    }
    if (existing && existing.status !== "revoked") {
      return { status: existing.status, approvalCode: existing.approvalCode, deviceId: existing.id };
    }

    const approvalCode = newCode();
    // A newer request replaces any older pending one, so approvers see one request per member.
    await db
      .delete(device)
      .where(and(eq(device.memberId, me.id), eq(device.status, "pending"), ne(device.keyThumbprint, thumbprint)));
    let deviceId: string;
    if (existing) {
      await db
        .update(device)
        .set({ status: "pending", approvalCode, label: data.label, userAgent: meta.userAgent, revokedAt: null })
        .where(eq(device.id, existing.id));
      deviceId = existing.id;
    } else {
      const [row] = await db
        .insert(device)
        .values({
          memberId: me.id,
          keyThumbprint: thumbprint,
          publicKeyJwk: jwk,
          label: data.label,
          userAgent: meta.userAgent,
          approvalCode,
        })
        .returning({ id: device.id });
      deviceId = row.id;
    }
    await audit({ actorId: me.id, action: "device.register", entity: "device", entityId: deviceId, after: { label: data.label } });

    const approvers = await membersWithRoles(["attendance_coordinator", "secretary_treasurer"]);
    await notify(approvers, {
      title: `Device approval needed: ${me.fullName}`,
      body: `${data.label} · code ${approvalCode}`,
      link: "/admin/devices",
    });
    await notify(
      [me.id],
      {
        title: "A phone was registered on your BNI Dheeras account",
        body: `${data.label}. If this wasn't you, tell the Attendance Coordinator right away.`,
        link: "/me",
      },
      { email: true },
    );
    refresh();
    return { status: "pending" as const, approvalCode, deviceId };
  });
}

/** Approve a pending device. Any other approved device of that member is revoked. */
export async function approveDevice(deviceId: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("devices.approve");
    const [d] = await db.select().from(device).where(eq(device.id, deviceId));
    if (!d) throw new UserError("Device not found.");
    if (d.status !== "pending") throw new UserError("This device is not waiting for approval.");
    if (d.memberId === me.id && !me.isAdmin) throw new UserError("Someone else must approve your own phone.");
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(device)
        .set({ status: "revoked", revokedAt: now, revokedById: me.id })
        .where(and(eq(device.memberId, d.memberId), eq(device.status, "approved")));
      await tx
        .update(device)
        .set({ status: "approved", approvedAt: now, approvedById: me.id })
        .where(eq(device.id, d.id));
      await audit({ actorId: me.id, action: "device.approve", entity: "device", entityId: d.id, after: { memberId: d.memberId, label: d.label } }, tx);
    });
    await notify([d.memberId], {
      title: "Your phone is approved for check-in",
      body: `${d.label} can now scan the venue QR. Any older phone was switched off.`,
      link: "/scan",
    });
    refresh();
    return null;
  });
}

export async function revokeDevice(deviceId: string, reason: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("devices.approve");
    const why = z.string().trim().min(3, "Give a reason").max(200).parse(reason);
    const [d] = await db
      .update(device)
      .set({ status: "revoked", revokedAt: new Date(), revokedById: me.id })
      .where(eq(device.id, deviceId))
      .returning();
    if (!d) throw new UserError("Device not found.");
    await audit({ actorId: me.id, action: "device.revoke", entity: "device", entityId: d.id, reason: why });
    await notify([d.memberId], {
      title: "A phone was removed from your account",
      body: `${d.label}: ${why}`,
      link: "/me",
    });
    refresh();
    return null;
  });
}
