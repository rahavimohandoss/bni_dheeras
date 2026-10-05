"use server";

import { timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { member } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { ensureDefaults } from "@/lib/defaults";
import { createLoginLink } from "@/lib/login-links";
import { createMember, memberInputSchema } from "@/lib/members";

function tokenMatches(given: string): boolean {
  const expected = process.env.SETUP_TOKEN;
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Creates the first admin and returns a one-time sign-in link for them. */
export async function completeSetup(_prev: unknown, formData: FormData): Promise<ActionResult<{ loginUrl: string }>> {
  return runAction(async () => {
    if (!tokenMatches(String(formData.get("token") ?? ""))) throw new UserError("The setup token is not correct.");
    const admins = await db.select({ id: member.id }).from(member).where(eq(member.isAdmin, true)).limit(1);
    if (admins.length) throw new UserError("Setup is already complete.");
    const input = memberInputSchema.parse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      phone: formData.get("phone") || undefined,
    });
    const id = await createMember({ ...input, isAdmin: true });
    await ensureDefaults();
    await audit({ actorId: id, action: "setup.complete", entity: "member", entityId: id });
    const link = await createLoginLink(input.email);
    return { loginUrl: link.url };
  });
}

/**
 * Break-glass access: with SETUP_TOKEN set in Vercel, an existing admin can get
 * a fresh sign-in link (e.g. the only admin lost their phone). Remove
 * SETUP_TOKEN again afterwards.
 */
export async function recoverAdmin(_prev: unknown, formData: FormData): Promise<ActionResult<{ loginUrl: string }>> {
  return runAction(async () => {
    if (!tokenMatches(String(formData.get("token") ?? ""))) throw new UserError("The setup token is not correct.");
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const [admin] = await db
      .select({ id: member.id, email: member.email })
      .from(member)
      .where(and(eq(member.email, email), eq(member.isAdmin, true), eq(member.status, "active")));
    if (!admin) throw new UserError("No active admin has that email.");
    await audit({ actorId: admin.id, action: "setup.admin_recovery_link", entity: "member", entityId: admin.id });
    const link = await createLoginLink(admin.email);
    return { loginUrl: link.url };
  });
}
