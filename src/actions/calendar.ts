"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { CALENDAR_KINDS, calendarEvent } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { assertCap } from "@/lib/session";
import { istToDate } from "@/lib/time";

const eventSchema = z.object({
  kind: z.enum(CALENDAR_KINDS),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().transform((v) => v || null),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick a start time"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick an end time"),
  location: z.string().trim().max(200).optional().transform((v) => v || null),
  link: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => v || null)
    .refine((v) => !v || /^https?:\/\//.test(v), "Links must start with http:// or https://"),
  memberId: z.string().optional().transform((v) => v || null),
});

export async function saveCalendarEvent(id: string | null, input: z.input<typeof eventSchema>): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("calendar.manage");
    const d = eventSchema.parse(input);
    const startsAt = istToDate(d.date, d.startTime);
    const endsAt = istToDate(d.date, d.endTime);
    if (endsAt <= startsAt) throw new UserError("End time must be after the start time.");
    const values = {
      kind: d.kind,
      title: d.title,
      description: d.description,
      startsAt,
      endsAt,
      location: d.location,
      link: d.link,
      memberId: d.memberId,
    };
    if (id) {
      const [before] = await db.select().from(calendarEvent).where(eq(calendarEvent.id, z.uuid().parse(id)));
      if (!before) throw new UserError("Calendar item not found.");
      await db.update(calendarEvent).set(values).where(eq(calendarEvent.id, before.id));
      await audit({ actorId: me.id, action: "calendar.update", entity: "calendar_event", entityId: before.id, after: d });
    } else {
      const [row] = await db
        .insert(calendarEvent)
        .values({ ...values, createdById: me.id })
        .returning({ id: calendarEvent.id });
      await audit({ actorId: me.id, action: "calendar.create", entity: "calendar_event", entityId: row.id, after: d });
    }
    refresh();
    return null;
  });
}

export async function deleteCalendarEvent(id: string): Promise<ActionResult> {
  return runAction(async () => {
    const me = await assertCap("calendar.manage");
    const [row] = await db.select().from(calendarEvent).where(eq(calendarEvent.id, z.uuid().parse(id)));
    if (!row) throw new UserError("Calendar item not found.");
    await db.delete(calendarEvent).where(eq(calendarEvent.id, row.id));
    await audit({ actorId: me.id, action: "calendar.delete", entity: "calendar_event", entityId: row.id, before: row });
    refresh();
    return null;
  });
}
