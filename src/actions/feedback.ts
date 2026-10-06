"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, feedback, member } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { membersWithRoles, notify } from "@/lib/notify";
import { assertCap, assertMember } from "@/lib/session";

const KIND_LABEL = { suggestion: "suggestion", feedback: "feedback" } as const;
const STATUS_LABEL = { new: "New", in_progress: "In progress", done: "Done" } as const;

const submitSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(5, "Write a little more (at least 5 characters).").max(2000),
  anonymous: z.boolean(),
});

/** Any signed-in member: a suggestion or feedback for the Head Table. */
export async function submitFeedback(input: z.input<typeof submitSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertMember();
    const data = submitSchema.parse(input);
    const [row] = await db
      .insert(feedback)
      .values({ memberId: me.id, kind: data.kind, message: data.message, anonymous: data.anonymous })
      .returning({ id: feedback.id });
    const headTable = await membersWithRoles(["president", "vice_president", "secretary_treasurer"]);
    const admins = (await db.select({ id: member.id }).from(member).where(and(eq(member.isAdmin, true), eq(member.status, "active")))).map(
      (a) => a.id,
    );
    await notify(
      [...headTable, ...admins].filter((id) => id !== me.id),
      {
        title: `New ${KIND_LABEL[data.kind]} from ${data.anonymous ? "a member" : me.fullName}`,
        body: data.message.length > 140 ? `${data.message.slice(0, 140)}…` : data.message,
        link: "/admin/feedback",
      },
    );
    // The audit log names the actor, so an anonymous submission isn't logged there.
    if (!data.anonymous) await audit({ actorId: me.id, action: "feedback.submit", entity: "feedback", entityId: row.id });
    refresh();
    return null;
  });
}

const reviewSchema = z.object({
  id: z.uuid(),
  status: z.enum(FEEDBACK_STATUSES),
  response: z.string().trim().max(2000).optional().transform((v) => v || null),
});

/** Head Table: set the status and (optionally) reply. The member is notified of a new reply. */
export async function reviewFeedback(input: z.input<typeof reviewSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("feedback.manage");
    const data = reviewSchema.parse(input);
    const [before] = await db.select().from(feedback).where(eq(feedback.id, data.id));
    if (!before) throw new UserError("Not found.");
    const replied = data.response !== null && data.response !== before.response;
    await db
      .update(feedback)
      .set({
        status: data.status,
        response: data.response,
        ...(replied ? { respondedById: me.id, respondedAt: new Date() } : {}),
      })
      .where(eq(feedback.id, data.id));
    if (replied || data.status !== before.status) {
      await notify([before.memberId], {
        title: replied ? `The Head Table replied to your ${KIND_LABEL[before.kind]}` : `Your ${KIND_LABEL[before.kind]} is now "${STATUS_LABEL[data.status]}"`,
        body: replied ? data.response! : undefined,
        link: "/feedback",
      });
    }
    await audit({
      actorId: me.id,
      action: "feedback.review",
      entity: "feedback",
      entityId: data.id,
      before: { status: before.status },
      after: { status: data.status, replied },
    });
    refresh();
    return null;
  });
}

/** Head Table: remove a submission (e.g. spam or a duplicate). */
export async function deleteFeedback(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("feedback.manage");
    const [row] = await db.delete(feedback).where(eq(feedback.id, z.uuid().parse(id))).returning();
    if (!row) throw new UserError("Not found.");
    await audit({ actorId: me.id, action: "feedback.delete", entity: "feedback", entityId: row.id, before: { kind: row.kind } });
    refresh();
    return null;
  });
}
