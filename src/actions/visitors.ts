"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { meeting, visitor } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { normalizePhone } from "@/lib/format";
import { assertAnyCap } from "@/lib/session";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const visitorsSchema = z.object({
  meetingId: z.uuid(),
  /** Visitors counted at the door; details can be filled in for some or all of them. */
  count: z.coerce.number().int().min(0).max(500),
  visitors: z
    .array(
      z.object({
        name: z.string().trim().max(120),
        phone: text(20),
        business: text(120),
        category: text(120),
        invitedById: text(60),
        note: text(300),
      }),
    )
    .max(100),
});

/** Saves the visitor count and the details taken for them (Admin → Meetings → Visitors). */
export async function saveVisitors(input: z.input<typeof visitorsSchema>): Promise<ActionResult<{ saved: number }>> {
  return runAction(async () => {
    const me = await assertAnyCap(["kiosk.run", "meeting.finalize"]);
    const data = visitorsSchema.parse(input);
    const [m] = await db.select({ id: meeting.id, count: meeting.visitorCount }).from(meeting).where(eq(meeting.id, data.meetingId));
    if (!m) throw new UserError("Meeting not found.");

    // Rows with no name are empty slots, not visitors.
    const rows = data.visitors
      .filter((v) => v.name.length >= 2)
      .map((v) => ({
        meetingId: m.id,
        name: v.name,
        phone: v.phone ? (normalizePhone(v.phone) ?? v.phone) : null,
        business: v.business,
        category: v.category,
        invitedById: v.invitedById,
        note: v.note,
        createdById: me.id,
      }));
    // Never fewer than the names entered, so the count and the list can't contradict each other.
    const count = Math.max(data.count, rows.length);

    const had = await db.select({ n: visitor.id }).from(visitor).where(eq(visitor.meetingId, m.id));
    await db.transaction(async (tx) => {
      await tx.delete(visitor).where(eq(visitor.meetingId, m.id));
      if (rows.length) await tx.insert(visitor).values(rows);
      await tx.update(meeting).set({ visitorCount: count }).where(eq(meeting.id, m.id));
      await audit(
        {
          actorId: me.id,
          action: "meeting.visitors",
          entity: "meeting",
          entityId: m.id,
          before: { count: m.count, named: had.length },
          after: { count, named: rows.length, visitors: rows.map((r) => ({ name: r.name, business: r.business })) },
        },
        tx,
      );
    });
    refresh();
    return { saved: rows.length };
  });
}
