"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { award, awardType, meeting } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { assertCap } from "@/lib/session";
import { formatDate } from "@/lib/time";

const entrySchema = z.object({
  awardTypeId: z.uuid(),
  memberId: z.string().optional().transform((v) => v || null),
  note: z.string().trim().max(200).optional().transform((v) => v || null),
  value: z.string().trim().max(60).optional().transform((v) => v || null),
});

/**
 * Saves the week's winners for one meeting. Empty member = no winner for that
 * award. `publish` makes them visible to everyone and notifies the winners.
 */
export async function saveAwards(
  meetingId: string,
  entries: z.input<typeof entrySchema>[],
  publish: boolean,
): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("awards.manage");
    const [m] = await db.select().from(meeting).where(eq(meeting.id, z.uuid().parse(meetingId)));
    if (!m) throw new UserError("Meeting not found.");
    const parsed = z.array(entrySchema).max(20).parse(entries);
    const types = new Set((await db.select({ id: awardType.id }).from(awardType)).map((t) => t.id));

    const before = await db.select().from(award).where(eq(award.meetingId, m.id));
    await db.transaction(async (tx) => {
      for (const e of parsed) {
        if (!types.has(e.awardTypeId)) continue;
        if (!e.memberId) {
          await tx.delete(award).where(and(eq(award.meetingId, m.id), eq(award.awardTypeId, e.awardTypeId)));
          continue;
        }
        const values = { memberId: e.memberId, note: e.note, value: e.value, published: publish };
        await tx
          .insert(award)
          .values({ meetingId: m.id, awardTypeId: e.awardTypeId, createdById: me.id, ...values })
          .onConflictDoUpdate({ target: [award.meetingId, award.awardTypeId], set: values });
      }
      await audit(
        { actorId: me.id, action: publish ? "awards.publish" : "awards.save_draft", entity: "meeting", entityId: m.id, after: parsed },
        tx,
      );
    });

    if (publish) {
      const wasPublished = new Set(before.filter((b) => b.published).map((b) => `${b.awardTypeId}:${b.memberId}`));
      const newWinners = parsed.filter((e) => e.memberId && !wasPublished.has(`${e.awardTypeId}:${e.memberId}`));
      const typeNames = new Map((await db.select().from(awardType)).map((t) => [t.id, t.name]));
      for (const w of newWinners) {
        await notify([w.memberId!], {
          title: `Congratulations! ${typeNames.get(w.awardTypeId) ?? "Weekly recognition"}`,
          body: `For the meeting on ${formatDate(m.startsAt)}.`,
          link: "/awards",
        });
      }
    }
    refresh();
    return null;
  });
}
