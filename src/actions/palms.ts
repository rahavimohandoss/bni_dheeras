"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { attendance, ATTENDANCE_STATUSES, meeting } from "@/db/schema";
import { type ActionResult, runAction, UserError } from "@/lib/action";
import { audit } from "@/lib/audit";
import { assertCap } from "@/lib/session";

/** "" means no status yet: the member's row is removed from the sheet. */
const sheetSchema = z.object({
  meetingId: z.uuid(),
  reason: z.string().trim().max(200).optional(),
  rows: z
    .array(z.object({ memberId: z.string().min(1), status: z.enum([...ATTENDANCE_STATUSES, ""]) }))
    .max(300),
});

/**
 * Enters a whole meeting's PALMS in one go (Admin → Meetings → Enter PALMS),
 * for meetings recorded on paper or in BNI Connect rather than by check-in.
 * Only the rows that change are written, so QR check-in times are kept.
 */
export async function savePalms(input: z.input<typeof sheetSchema>): Promise<ActionResult<{ changed: number }>> {
  return runAction(async () => {
    const me = await assertCap("attendance.manual");
    const data = sheetSchema.parse(input);
    const [m] = await db.select().from(meeting).where(eq(meeting.id, data.meetingId));
    if (!m) throw new UserError("Meeting not found.");
    if (m.status === "finalized") {
      throw new UserError('This meeting is finalized. Use "Reopen for corrections" on the PALMS summary first.');
    }
    if (m.status === "cancelled") throw new UserError("This meeting was cancelled.");

    const existing = await db.select().from(attendance).where(eq(attendance.meetingId, m.id));
    const before = new Map(existing.map((r) => [r.memberId, r]));
    const why = data.reason?.trim() ?? "";
    // Changing attendance that is already recorded needs a reason; the first entry doesn't.
    if (existing.length > 0 && why.length < 3) {
      throw new UserError("Give a reason for changing attendance that is already recorded.");
    }

    const now = new Date();
    const changes = data.rows
      .map((row) => ({ ...row, from: before.get(row.memberId)?.status ?? "" }))
      .filter((row) => row.from !== row.status);
    if (changes.length === 0) return { changed: 0 };

    await db.transaction(async (tx) => {
      for (const row of changes) {
        const where = and(eq(attendance.meetingId, m.id), eq(attendance.memberId, row.memberId));
        if (!row.status) {
          await tx.delete(attendance).where(where);
          continue;
        }
        const present = row.status === "P" || row.status === "L";
        const values = {
          status: row.status,
          method: "manual" as const,
          // Keep the time of a real check-in; A, M and S have no time.
          checkedInAt: present ? (before.get(row.memberId)?.checkedInAt ?? now) : null,
          setById: me.id,
        };
        if (before.has(row.memberId)) await tx.update(attendance).set(values).where(where);
        else await tx.insert(attendance).values({ meetingId: m.id, memberId: row.memberId, ...values });
      }
      await audit(
        {
          actorId: me.id,
          action: "attendance.sheet",
          entity: "meeting",
          entityId: m.id,
          after: { changed: changes.map((c) => ({ memberId: c.memberId, from: c.from || null, to: c.status || null })) },
          reason: why || null,
        },
        tx,
      );
    });
    refresh();
    return { changed: changes.length };
  });
}
