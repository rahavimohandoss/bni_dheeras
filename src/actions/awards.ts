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
    const types = new Map((await db.select().from(awardType)).map((t) => [t.id, t]));

    const before = await db.select().from(award).where(eq(award.meetingId, m.id));
    await db.transaction(async (tx) => {
      for (const e of parsed) {
        const type = types.get(e.awardTypeId);
        if (!type) continue;
        if (!e.memberId) {
          await tx.delete(award).where(and(eq(award.meetingId, m.id), eq(award.awardTypeId, e.awardTypeId)));
          continue;
        }
        const values = {
          memberId: e.memberId,
          // Only the fields this recognition uses (e.g. Best Attire has neither).
          note: type.noteEnabled ? e.note : null,
          value: type.valueEnabled ? e.value : null,
          published: publish,
        };
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
      for (const w of newWinners) {
        await notify([w.memberId!], {
          title: `Congratulations! ${types.get(w.awardTypeId)?.name ?? "Weekly recognition"}`,
          body: `For the meeting on ${formatDate(m.startsAt)}.`,
          link: "/awards",
        });
      }
    }
    refresh();
    return null;
  });
}

/** Deletes a meeting's recognitions, draft or published. Winners keep any notification they already got. */
export async function deleteAwards(meetingId: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("awards.manage");
    const id = z.uuid().parse(meetingId);
    const removed = await db
      .delete(award)
      .where(eq(award.meetingId, id))
      .returning({ awardTypeId: award.awardTypeId, memberId: award.memberId, published: award.published });
    if (removed.length === 0) throw new UserError("There are no recognitions to delete for this meeting.");
    await audit({ actorId: me.id, action: "awards.delete", entity: "meeting", entityId: id, before: removed });
    refresh();
    return null;
  });
}

/** Hides a meeting's recognitions again (e.g. published by mistake). Winners keep their notification. */
export async function unpublishAwards(meetingId: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("awards.manage");
    const id = z.uuid().parse(meetingId);
    await db.update(award).set({ published: false }).where(eq(award.meetingId, id));
    await audit({ actorId: me.id, action: "awards.unpublish", entity: "meeting", entityId: id });
    refresh();
    return null;
  });
}
