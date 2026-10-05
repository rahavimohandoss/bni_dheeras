"use server";

import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { member } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { ensureDefaults } from "@/lib/defaults";
import { createMember, memberInputSchema } from "@/lib/members";

function tokenMatches(given: string): boolean {
  const expected = process.env.SETUP_TOKEN;
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function completeSetup(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    if (!tokenMatches(String(formData.get("token") ?? ""))) throw new UserError("The setup token is not correct.");
    const admins = await db.select({ id: member.id }).from(member).where(eq(member.isAdmin, true)).limit(1);
    if (admins.length) throw new UserError("Setup is already complete. Sign in instead.");
    const input = memberInputSchema.parse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      phone: formData.get("phone") || undefined,
    });
    const id = await createMember({ ...input, isAdmin: true });
    await ensureDefaults();
    await audit({ actorId: id, action: "setup.complete", entity: "member", entityId: id });
    return null;
  });
}
