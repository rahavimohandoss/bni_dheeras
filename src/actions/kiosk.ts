"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { kiosk } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { createPairingCode, pairWithCode } from "@/lib/kiosk";
import { assertCap } from "@/lib/session";

export async function newPairingCode(label: string): Promise<ActionResult<{ code: string }>> {
  return runAction(async () => {
    const me = await assertCap("kiosk.run");
    const name = z.string().trim().min(2, "Name the screen").max(60).parse(label);
    return { code: await createPairingCode(me.id, name) };
  });
}

export async function pairKiosk(_prev: unknown, formData: FormData): Promise<ActionResult<{ label: string }>> {
  return runAction(async () => {
    const code = String(formData.get("code") ?? "").replace(/\D/g, "");
    if (code.length !== 6) throw new UserError("Enter the 6-digit code.");
    const res = await pairWithCode(code);
    if (!res.ok) throw new UserError(res.error);
    return { label: res.label };
  });
}

export async function revokeKiosk(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("kiosk.run");
    await db.update(kiosk).set({ revokedAt: new Date() }).where(eq(kiosk.id, z.uuid().parse(id)));
    await audit({ actorId: me.id, action: "kiosk.revoke", entity: "kiosk", entityId: id });
    refresh();
    return null;
  });
}
