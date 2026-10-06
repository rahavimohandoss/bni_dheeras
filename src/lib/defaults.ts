import "server-only";
import { and, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { awardType, term } from "@/db/schema";
import { DEFAULT_AWARDS } from "@/lib/award-defaults";
import { toIstDateInput } from "@/lib/time";

/** BNI terms here run April–September and October–March. */
export function termFor(date: Date): { name: string; startsOn: string; endsOn: string } {
  const [y, m] = toIstDateInput(date).split("-").map(Number);
  if (m >= 4 && m <= 9) return { name: `Apr–Sep ${y}`, startsOn: `${y}-04-01`, endsOn: `${y}-09-30` };
  const startYear = m >= 10 ? y : y - 1;
  return {
    name: `Oct ${startYear} – Mar ${startYear + 1}`,
    startsOn: `${startYear}-10-01`,
    endsOn: `${startYear + 1}-03-31`,
  };
}

/** Idempotent: award types and a term covering today. */
export async function ensureDefaults() {
  const existing = await db.select({ id: awardType.id }).from(awardType).limit(1);
  if (existing.length === 0) {
    await db
      .insert(awardType)
      .values(DEFAULT_AWARDS.map((a, i) => ({ ...a, sortOrder: i })))
      .onConflictDoNothing();
  }
  const today = toIstDateInput(new Date());
  const current = await db
    .select({ id: term.id })
    .from(term)
    .where(and(lte(term.startsOn, today), gte(term.endsOn, today)))
    .limit(1);
  if (current.length === 0) await db.insert(term).values(termFor(new Date()));
}
