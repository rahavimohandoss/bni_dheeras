import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { setting } from "@/db/schema";
import { DEFAULT_DANCE_CARD_TEMPLATE, type DanceCardTemplate, danceCardTemplateSchema } from "@/lib/dance-card";

export const attendanceSettingsSchema = z.object({
  /** Minutes after start that still count as on time. null = exact start time. */
  defaultGraceMinutes: z.number().int().min(0).max(120).nullable(),
  defaultGeofenceM: z.number().int().min(25).max(2000),
  /** How much reported GPS inaccuracy is forgiven, capped at this many metres. */
  gpsAccuracyAllowanceM: z.number().int().min(0).max(500),
  /** GPS fixes less accurate than this are refused. */
  maxGpsAccuracyM: z.number().int().min(50).max(5000),
  checkinOpensBeforeMin: z.number().int().min(0).max(240),
  absenceLimit: z.number().int().min(1).max(12),
  absenceWindowMonths: z.number().int().min(1).max(12),
  lateFlagCount: z.number().int().min(1).max(12),
  lateFlagWeeks: z.number().int().min(1).max(26),
});
export type AttendanceSettings = z.infer<typeof attendanceSettingsSchema>;

export const DEFAULT_ATTENDANCE_SETTINGS: AttendanceSettings = {
  defaultGraceMinutes: null,
  defaultGeofenceM: 150,
  gpsAccuracyAllowanceM: 50,
  maxGpsAccuracyM: 500,
  checkinOpensBeforeMin: 60,
  absenceLimit: 3,
  absenceWindowMonths: 6,
  lateFlagCount: 3,
  lateFlagWeeks: 8,
};

async function readSetting<T>(key: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  const [row] = await db.select().from(setting).where(eq(setting.key, key));
  if (!row) return fallback;
  const parsed = schema.safeParse(row.value);
  return parsed.success ? parsed.data : fallback;
}

export async function writeSetting(key: string, value: unknown, actorId: string | null) {
  await db
    .insert(setting)
    .values({ key, value, updatedById: actorId })
    .onConflictDoUpdate({
      target: setting.key,
      set: { value, updatedById: actorId, updatedAt: new Date() },
    });
}

export function getAttendanceSettings(): Promise<AttendanceSettings> {
  return readSetting("attendance", attendanceSettingsSchema, DEFAULT_ATTENDANCE_SETTINGS);
}

export function getDanceCardTemplate(): Promise<DanceCardTemplate> {
  return readSetting("danceCardTemplate", danceCardTemplateSchema, DEFAULT_DANCE_CARD_TEMPLATE);
}
