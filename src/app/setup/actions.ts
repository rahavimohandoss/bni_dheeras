"use server";

import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { member } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { ensureDefaults } from "@/lib/defaults";
import { parseLoginId } from "@/lib/format";
import { createMember, memberInputSchema } from "@/lib/members";
import { assertNewPassword, hashPassword, storePassword } from "@/lib/passwords";
import { hasFullAccess } from "@/lib/permissions";
import { getCurrentRoles } from "@/lib/session";

function tokenMatches(given: string): boolean {
  const expected = process.env.SETUP_TOKEN;
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Creates the first admin with their own password and signs them in. */
export async function completeSetup(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    if (!tokenMatches(String(formData.get("token") ?? ""))) throw new UserError("The setup token is not correct.");
    const admins = await db.select({ id: member.id }).from(member).where(eq(member.isAdmin, true)).limit(1);
    if (admins.length) throw new UserError("Setup is already complete.");
    const input = memberInputSchema.parse({
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      phone: formData.get("phone") || undefined,
    });
    const password = String(formData.get("password") ?? "");
    await assertNewPassword(password, String(formData.get("confirm") ?? ""));
    const id = await createMember(
      { ...input, isAdmin: true, isChapterMember: formData.get("isChapterMember") === "on" },
      { passwordHash: await hashPassword(password), mustChangePassword: false },
    );
    await ensureDefaults();
    await audit({ actorId: id, action: "setup.complete", entity: "member", entityId: id });
    await auth.api.signInEmail({ body: { email: input.email, password, rememberMe: true }, headers: await headers() });
    redirect("/");
  });
}

/**
 * Break-glass access: with SETUP_TOKEN set in Vercel, an admin or the current
 * President who can't sign in sets a new password here. Remove SETUP_TOKEN
 * again afterwards.
 */
export async function recoverAdmin(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    if (!tokenMatches(String(formData.get("token") ?? ""))) throw new UserError("The setup token is not correct.");
    const loginId = parseLoginId(String(formData.get("loginId") ?? ""));
    const [m] = loginId
      ? await db
          .select({ id: member.id, isAdmin: member.isAdmin, status: member.status })
          .from(member)
          .where("email" in loginId ? eq(member.email, loginId.email) : eq(member.phone, loginId.phone))
      : [];
    if (!m || m.status !== "active" || !hasFullAccess(await getCurrentRoles(m.id), m.isAdmin)) {
      throw new UserError("No active admin or President has that mobile number or email.");
    }
    const password = String(formData.get("password") ?? "");
    await assertNewPassword(password, String(formData.get("confirm") ?? ""));
    await storePassword(m.id, await hashPassword(password), false);
    await audit({ actorId: m.id, action: "setup.password_recovery", entity: "member", entityId: m.id });
    return null;
  });
}
