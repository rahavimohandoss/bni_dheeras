"use server";

import { count, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { meeting, venue } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { assertCap } from "@/lib/session";

const venueSchema = z.object({
  name: z.string().trim().min(2, "Name the venue").max(120),
  address: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null),
});

export async function saveVenue(id: string | null, input: z.input<typeof venueSchema>): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const me = await assertCap("meetings.manage");
    const data = venueSchema.parse(input);
    if (id) {
      const [before] = await db.select().from(venue).where(eq(venue.id, z.uuid().parse(id)));
      if (!before) throw new UserError("Venue not found.");
      await db.update(venue).set(data).where(eq(venue.id, before.id));
      await audit({ actorId: me.id, action: "venue.update", entity: "venue", entityId: before.id, before, after: data });
      refresh();
      return { id: before.id };
    }
    const [row] = await db.insert(venue).values(data).returning({ id: venue.id });
    await audit({ actorId: me.id, action: "venue.create", entity: "venue", entityId: row.id, after: data });
    refresh();
    return { id: row.id };
  });
}

export async function setVenueActive(id: string, isActive: boolean): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("meetings.manage");
    await db.update(venue).set({ isActive }).where(eq(venue.id, z.uuid().parse(id)));
    await audit({ actorId: me.id, action: isActive ? "venue.activate" : "venue.deactivate", entity: "venue", entityId: id });
    refresh();
    return null;
  });
}

/** Deletes a venue that no meeting has ever used (otherwise deactivate it). */
export async function deleteVenue(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("meetings.manage");
    const venueId = z.uuid().parse(id);
    const [{ used }] = await db.select({ used: count() }).from(meeting).where(eq(meeting.venueId, venueId));
    if (used > 0) throw new UserError("Meetings have used this venue, so it stays for their history. Deactivate it instead.");
    const [row] = await db.delete(venue).where(eq(venue.id, venueId)).returning();
    if (!row) throw new UserError("Venue not found.");
    await audit({ actorId: me.id, action: "venue.delete", entity: "venue", entityId: row.id, before: { name: row.name } });
    refresh();
    return null;
  });
}
