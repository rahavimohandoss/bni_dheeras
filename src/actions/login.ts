"use server";

import { and, eq, gte, like } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { member, notification } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { createLoginLink, whatsappMessage } from "@/lib/login-links";
import { normalizePhone, whatsappLink } from "@/lib/members";
import { membersWithRoles, notify } from "@/lib/notify";
import { assertCap } from "@/lib/session";

export type LoginLink = { url: string; whatsappUrl: string | null; expiresAt: string; name: string };

/** Secretary/Admin creates a one-time login link for a member, to send on WhatsApp. */
export async function createMemberLoginLink(memberId: string): Promise<ActionResult<LoginLink>> {
  return runAction(async () => {
    const me = await assertCap("members.manage");
    const [m] = await db
      .select({ id: member.id, fullName: member.fullName, email: member.email, phone: member.phone, status: member.status })
      .from(member)
      .where(eq(member.id, z.string().min(1).parse(memberId)));
    if (!m) throw new UserError("Member not found.");
    if (m.status !== "active") throw new UserError("Reactivate this member before creating a login link.");
    const link = await createLoginLink(m.email);
    await audit({ actorId: me.id, action: "member.login_link", entity: "member", entityId: m.id });
    const wa = whatsappLink(m.phone);
    const text = encodeURIComponent(whatsappMessage(m.fullName.split(" ")[0], link.url));
    return {
      url: link.url,
      whatsappUrl: wa ? `${wa}?text=${text}` : null,
      expiresAt: link.expiresAt.toISOString(),
      name: m.fullName,
    };
  });
}

/**
 * From the login page: "send me a login link". Notifies the people who can
 * create links. Always answers the same way, so it can't be used to discover
 * which numbers are registered.
 */
export async function requestLoginLink(phone: string): Promise<ActionResult> {
  return runAction(async () => {
    const parsed = z.string().trim().min(8).max(20).safeParse(phone);
    const normalized = parsed.success ? normalizePhone(parsed.data) : null;
    if (!normalized) throw new UserError("Enter your registered mobile number.");
    const [m] = await db
      .select({ id: member.id, fullName: member.fullName })
      .from(member)
      .where(and(eq(member.phone, normalized), eq(member.status, "active")));
    if (!m) return null;
    // At most one request per member every 30 minutes.
    const recent = await db
      .select({ id: notification.id })
      .from(notification)
      .where(
        and(
          like(notification.title, `Login link requested: ${m.fullName}%`),
          gte(notification.createdAt, new Date(Date.now() - 30 * 60_000)),
        ),
      )
      .limit(1);
    if (recent.length) return null;
    const admins = await membersWithRoles(["secretary_treasurer"]);
    const adminIds = (await db.select({ id: member.id }).from(member).where(eq(member.isAdmin, true))).map((a) => a.id);
    await notify([...admins, ...adminIds], {
      title: `Login link requested: ${m.fullName}`,
      body: "Open Admin → Members, tap Login link next to their name and send it on WhatsApp.",
      link: "/admin/members",
    });
    await audit({ actorId: null, action: "member.login_link_requested", entity: "member", entityId: m.id });
    return null;
  });
}
