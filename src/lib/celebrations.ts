import "server-only";
import { and, eq, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import { member, memberProfile } from "@/db/schema";
import { publicUrl } from "@/lib/storage";
import { toIstDateInput } from "@/lib/time";

export type Celebration = {
  memberId: string;
  name: string;
  photoUrl: string | null;
  kind: "birthday" | "anniversary";
  month: number; // 1–12
  day: number;
};

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Birthdays and wedding anniversaries of active chapter members, from their profiles. */
export async function getCelebrations(): Promise<Celebration[]> {
  const rows = await db
    .select({
      id: member.id,
      name: member.fullName,
      photoKey: member.photoKey,
      dateOfBirth: memberProfile.dateOfBirth,
      anniversaryDate: memberProfile.anniversaryDate,
    })
    .from(memberProfile)
    .innerJoin(member, eq(member.id, memberProfile.memberId))
    .where(
      and(
        eq(member.status, "active"),
        eq(member.isChapterMember, true),
        or(isNotNull(memberProfile.dateOfBirth), isNotNull(memberProfile.anniversaryDate)),
      ),
    );
  const list: Celebration[] = [];
  for (const r of rows) {
    const base = { memberId: r.id, name: r.name, photoUrl: publicUrl(r.photoKey) };
    if (r.dateOfBirth) list.push({ ...base, kind: "birthday", ...monthDay(r.dateOfBirth) });
    if (r.anniversaryDate) list.push({ ...base, kind: "anniversary", ...monthDay(r.anniversaryDate) });
  }
  return list.sort((a, b) => a.month - b.month || a.day - b.day || a.name.localeCompare(b.name));
}

function monthDay(isoDate: string) {
  const [, m, d] = isoDate.split("-").map(Number);
  return { month: m, day: d };
}

/** Today's month and day in IST. */
export function today(): { month: number; day: number; year: number } {
  const [y, m, d] = toIstDateInput(new Date()).split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** 29 February birthdays are celebrated on the 28th in other years. */
export function isToday(c: Celebration, now = today()): boolean {
  if (c.month !== now.month) return false;
  if (c.day === now.day) return true;
  const leap = (now.year % 4 === 0 && now.year % 100 !== 0) || now.year % 400 === 0;
  return c.month === 2 && c.day === 29 && now.day === 28 && !leap;
}

export const nextMonth = (month: number) => (month % 12) + 1;
