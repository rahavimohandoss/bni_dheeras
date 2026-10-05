/**
 * The chapter runs on India Standard Time, which is a fixed UTC+05:30 with no
 * daylight saving, so conversions are plain arithmetic. All instants are stored
 * as UTC timestamps; these helpers only convert at the edges (forms, display).
 */
export const TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-10-08" + "07:00" (IST wall clock) -> UTC instant. */
export function istToDate(dateStr: string, timeStr = "00:00"): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - IST_OFFSET_MS);
}

function istFields(date: Date) {
  const t = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    hh: t.getUTCHours(),
    mm: t.getUTCMinutes(),
    weekday: t.getUTCDay(),
  };
}

/** UTC instant -> "YYYY-MM-DD" in IST (for <input type="date">). */
export function toIstDateInput(date: Date): string {
  const f = istFields(date);
  return `${f.y}-${pad(f.m)}-${pad(f.d)}`;
}

/** UTC instant -> "HH:MM" in IST (for <input type="time">). */
export function toIstTimeInput(date: Date): string {
  const f = istFields(date);
  return `${pad(f.hh)}:${pad(f.mm)}`;
}

export function istWeekday(date: Date): number {
  return istFields(date).weekday;
}

/** Start of the IST calendar day that contains `date`. */
export function startOfIstDay(date: Date): Date {
  return istToDate(toIstDateInput(date));
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/** Calendar months back from `date`, same wall-clock time. */
export function subtractMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d;
}

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: TIME_ZONE, ...options });

const timeFmt = fmt({ hour: "numeric", minute: "2-digit", hour12: true });
const timeSecFmt = fmt({ hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true });
const dateFmt = fmt({ weekday: "short", day: "numeric", month: "short", year: "numeric" });
const shortDateFmt = fmt({ day: "numeric", month: "short" });
const dateTimeFmt = fmt({
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const monthFmt = fmt({ month: "long", year: "numeric" });

export const formatTime = (d: Date) => timeFmt.format(d);
export const formatTimeWithSeconds = (d: Date) => timeSecFmt.format(d);
export const formatDate = (d: Date) => dateFmt.format(d);
export const formatShortDate = (d: Date) => shortDateFmt.format(d);
export const formatDateTime = (d: Date) => dateTimeFmt.format(d);
export const formatMonth = (d: Date) => monthFmt.format(d);

/** `days` from now (negative = in the past). Keeps clock reads out of render code. */
export function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}
