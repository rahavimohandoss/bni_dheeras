import "server-only";
import { and, eq, gte, inArray, isNotNull, lt, lte } from "drizzle-orm";
import { db } from "@/db";
import { member, notification, roleAssignment, term } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { sendEmail } from "@/lib/email";
import type { Role } from "@/lib/permissions";
import { toIstDateInput } from "@/lib/time";

type Notice = { title: string; body?: string; link?: string };

/** In-app notification for each member, plus an email when `email` is set. */
export async function notify(memberIds: string[], notice: Notice, opts: { email?: boolean } = {}) {
  const ids = [...new Set(memberIds)];
  if (ids.length === 0) return;
  await db.insert(notification).values(
    ids.map((memberId) => ({ memberId, title: notice.title, body: notice.body, link: notice.link })),
  );
  if (opts.email) {
    const recipients = await db
      .select({ email: member.email })
      .from(member)
      .where(and(inArray(member.id, ids), eq(member.status, "active")));
    const base = appUrl();
    const text = [notice.body, notice.link ? `${base}${notice.link}` : null].filter(Boolean).join("\n\n");
    await Promise.all(
      recipients.map((r) => sendEmail({ to: r.email, subject: notice.title, text: text || notice.title })),
    );
  }
}

/** Active members holding any of `roles` in the current term. */
export async function membersWithRoles(roles: Role[]): Promise<string[]> {
  const today = toIstDateInput(new Date());
  const rows = await db
    .selectDistinct({ id: roleAssignment.memberId })
    .from(roleAssignment)
    .innerJoin(term, eq(term.id, roleAssignment.termId))
    .innerJoin(member, eq(member.id, roleAssignment.memberId))
    .where(
      and(
        inArray(roleAssignment.role, roles),
        lte(term.startsOn, today),
        gte(term.endsOn, today),
        eq(member.status, "active"),
      ),
    );
  return rows.map((r) => r.id);
}

/** Weekly clean-up: read notifications older than 90 days. */
export async function pruneOldNotifications(): Promise<void> {
  await db
    .delete(notification)
    .where(and(isNotNull(notification.readAt), lt(notification.createdAt, new Date(Date.now() - 90 * 86_400_000))));
}
