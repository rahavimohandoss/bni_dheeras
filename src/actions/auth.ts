"use server";

import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { member } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { appUrl } from "@/lib/app-url";
import { audit } from "@/lib/audit";
import { auth } from "@/lib/auth";
import { parseLoginId, whatsappLink } from "@/lib/format";
import {
  assertNewPassword,
  getDefaultPassword,
  hashPassword,
  recordLoginAttempt,
  storedPasswordHash,
  storePassword,
  tooManyFailures,
  verifyPassword,
} from "@/lib/passwords";
import { capabilitiesFor, capsCover } from "@/lib/permissions";
import { requestMeta } from "@/lib/request-meta";
import { assertAnyCap, assertCap, assertMember, getCurrentRoles } from "@/lib/session";

const TOO_MANY = "Too many wrong attempts. Wait 15 minutes and try again.";

/** Sign in with mobile number (or email) and password. */
export async function signIn(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const loginId = parseLoginId(String(formData.get("loginId") ?? ""));
    const password = String(formData.get("password") ?? "");
    if (!loginId) throw new UserError("Enter your mobile number or email.");
    if (!password) throw new UserError("Enter your password.");
    const identifier = "email" in loginId ? loginId.email : loginId.phone;
    const { ip } = await requestMeta();
    if (await tooManyFailures(identifier, ip)) throw new UserError(TOO_MANY);

    const [m] = await db
      .select({ email: member.email })
      .from(member)
      .where("email" in loginId ? eq(member.email, loginId.email) : eq(member.phone, loginId.phone));
    try {
      // Unknown IDs still go through a full password check, so the reply time
      // doesn't reveal which numbers are registered.
      await auth.api.signInEmail({
        body: { email: m?.email ?? "nobody@unknown.invalid", password, rememberMe: true },
        headers: await headers(),
      });
    } catch (error) {
      if (!(error instanceof APIError)) throw error;
      if (error.status === "FORBIDDEN") throw new UserError("This account is not active. Please contact the Secretary.");
      await recordLoginAttempt(identifier, ip, false);
      throw new UserError("Wrong mobile number/email or password.");
    }
    await recordLoginAttempt(identifier, ip, true);
    redirect("/");
  });
}

/** First sign-in on the default password: the member chooses their own. */
export async function setOwnPassword(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    if (!me.mustChangePassword) throw new UserError("You already have your own password. Change it from your profile.");
    const next = String(formData.get("password") ?? "");
    await assertNewPassword(next, String(formData.get("confirm") ?? ""));
    await storePassword(me.id, await hashPassword(next), false);
    await audit({ actorId: me.id, action: "member.password_set", entity: "member", entityId: me.id });
    redirect("/");
  });
}

/** From the profile page; needs the current password. Stays signed in everywhere. */
export async function changeOwnPassword(_prev: unknown, formData: FormData): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    const key = `change:${me.id}`;
    const { ip } = await requestMeta();
    if (await tooManyFailures(key, null)) throw new UserError(TOO_MANY);
    const hash = await storedPasswordHash(me.id);
    if (!hash || !(await verifyPassword(hash, String(formData.get("current") ?? "")))) {
      await recordLoginAttempt(key, ip, false);
      throw new UserError("Your current password is wrong.");
    }
    const next = String(formData.get("password") ?? "");
    await assertNewPassword(next, String(formData.get("confirm") ?? ""));
    await storePassword(me.id, await hashPassword(next), false);
    await audit({ actorId: me.id, action: "member.password_change", entity: "member", entityId: me.id });
    return null;
  });
}

export type LoginDetails = {
  name: string;
  loginId: string;
  /** Set only while the member is still on the default password. */
  defaultPassword: string | null;
  whatsappUrl: string | null;
};

async function loginDetails(m: typeof member.$inferSelect): Promise<LoginDetails> {
  const loginId = m.phone ?? m.email;
  if (!m.mustChangePassword) return { name: m.fullName, loginId, defaultPassword: null, whatsappUrl: null };
  const defaultPassword = await getDefaultPassword();
  const wa = whatsappLink(m.phone);
  const text = [
    `Vanakkam ${m.fullName.split(" ")[0]}! Your BNI Dheeras app login:`,
    `${appUrl()}/login`,
    `Login ID: ${loginId}`,
    `Password: ${defaultPassword}`,
    "After you sign in, set your own password. Please sign in on the phone you'll use for check-in.",
  ].join("\n");
  return { name: m.fullName, loginId, defaultPassword, whatsappUrl: wa ? `${wa}?text=${encodeURIComponent(text)}` : null };
}

async function findActiveMember(memberId: string) {
  const [m] = await db.select().from(member).where(eq(member.id, z.string().min(1).parse(memberId)));
  if (!m) throw new UserError("Member not found.");
  if (m.status !== "active") throw new UserError("Reactivate this member first.");
  return m;
}

/** Head Table: how a member signs in (the default password while they're still on it). */
export async function getLoginDetails(memberId: string): Promise<ActionResult<LoginDetails>> {
  return runAction(async () => {
    await assertAnyCap(["members.reset_password", "members.manage"]);
    return loginDetails(await findActiveMember(memberId));
  });
}

/** Head Table: forgotten password → back to the default; they choose a new one at sign-in. */
export async function resetMemberPassword(memberId: string): Promise<ActionResult<LoginDetails>> {
  return runAction(async () => {
    const me = await assertCap("members.reset_password");
    const m = await findActiveMember(memberId);
    if (!capsCover(me.caps, capabilitiesFor(await getCurrentRoles(m.id), m.isAdmin))) {
      throw new UserError(`Only the President or an admin can reset ${m.fullName}'s password.`);
    }
    const hash = await hashPassword(await getDefaultPassword());
    await db.transaction(async (tx) => {
      await storePassword(m.id, hash, true, tx);
      await audit({ actorId: me.id, action: "member.password_reset", entity: "member", entityId: m.id, after: { member: m.fullName } }, tx);
    });
    refresh();
    return loginDetails({ ...m, mustChangePassword: true });
  });
}
