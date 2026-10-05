import { eq } from "drizzle-orm";
import { ChevronLeftIcon, ChevronRightIcon, ClockIcon, MapPinIcon, UserIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { member } from "@/db/schema";
import { type CalendarItem, calendarItems, KIND_LABELS } from "@/lib/calendar";
import { requireMember } from "@/lib/session";
import { formatDate, formatMonth, formatTime, istToDate, toIstDateInput } from "@/lib/time";
import { cn } from "@/lib/utils";
import { SubscribeButton } from "./subscribe-button";

export const metadata: Metadata = { title: "Calendar" };

const KIND_COLORS: Record<CalendarItem["kind"], string> = {
  meeting: "bg-primary text-primary-foreground",
  event: "bg-sky-600 text-white",
  training: "bg-emerald-600 text-white",
  feature_presentation: "bg-violet-600 text-white",
  education_slot: "bg-amber-600 text-white",
  other: "bg-neutral-500 text-white",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const me = await requireMember();
  const { m, mine } = await searchParams;
  const today = toIstDateInput(new Date());
  const [y, mo] = (typeof m === "string" && /^\d{4}-\d{2}$/.test(m) ? m : today.slice(0, 7)).split("-").map(Number);
  const monthStart = istToDate(`${y}-${String(mo).padStart(2, "0")}-01`);
  const nextMonth = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  const prevMonth = mo === 1 ? `${y - 1}-12` : `${y}-${String(mo - 1).padStart(2, "0")}`;
  const monthEnd = istToDate(`${nextMonth}-01`);

  const onlyMine = mine === "1";
  let items = await calendarItems(monthStart, monthEnd);
  if (onlyMine) items = items.filter((i) => i.presenter?.id === me.id);
  const [{ token }] = await db
    .select({ token: member.calendarToken })
    .from(member)
    .where(eq(member.id, me.id));

  // Month grid (Monday first), in IST.
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const byDay = new Map<number, CalendarItem[]>();
  for (const it of items) {
    const day = Number(toIstDateInput(it.startsAt).slice(8, 10));
    byDay.set(day, [...(byDay.get(day) ?? []), it]);
  }
  const todayDay = today.startsWith(`${y}-${String(mo).padStart(2, "0")}`) ? Number(today.slice(8, 10)) : null;
  const qs = (month: string) => `/calendar?m=${month}${onlyMine ? "&mine=1" : ""}`;

  return (
    <PageContainer wide>
      <PageHeader
        title="Calendar"
        description="Meetings, events, trainings and presentation slots."
        actions={
          <>
            <Button asChild variant={onlyMine ? "default" : "outline"} size="sm">
              <Link href={onlyMine ? `/calendar?m=${y}-${String(mo).padStart(2, "0")}` : `${qs(`${y}-${String(mo).padStart(2, "0")}`)}&mine=1`}>
                My slots
              </Link>
            </Button>
            <SubscribeButton path={`/api/calendar/${token}.ics`} />
          </>
        }
      />

      <div className="mb-3 flex items-center justify-between">
        <Button asChild variant="ghost" size="icon">
          <Link href={qs(prevMonth)} aria-label="Previous month">
            <ChevronLeftIcon />
          </Link>
        </Button>
        <h2 className="text-lg font-semibold">{formatMonth(monthStart)}</h2>
        <Button asChild variant="ghost" size="icon">
          <Link href={qs(nextMonth)} aria-label="Next month">
            <ChevronRightIcon />
          </Link>
        </Button>
      </div>

      <div className="mb-6 hidden overflow-hidden rounded-xl border sm:block">
        <div className="grid grid-cols-7 border-b bg-muted text-center text-xs font-medium text-muted-foreground">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => (
            <div key={i} className={cn("min-h-24 border-r border-b p-1.5 text-xs", (i + 1) % 7 === 0 && "border-r-0")}>
              {day ? (
                <>
                  <div
                    className={cn(
                      "mb-1 flex size-6 items-center justify-center rounded-full text-xs",
                      day === todayDay && "bg-primary font-bold text-primary-foreground",
                    )}
                  >
                    {day}
                  </div>
                  <div className="space-y-1">
                    {(byDay.get(day) ?? []).map((it) => (
                      <a
                        key={it.id}
                        href={`#item-${it.id}`}
                        className={cn("block truncate rounded px-1 py-0.5", KIND_COLORS[it.kind], it.cancelled && "line-through opacity-60")}
                      >
                        {formatTime(it.startsAt)} {it.title}
                      </a>
                    ))}
                  </div>
                </>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <h2 className="mb-2 font-semibold">Agenda</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing scheduled this month{onlyMine ? " for you" : ""}.</p>
      ) : (
        <div className="divide-y rounded-xl border">
          {items.map((it) => (
            <div key={it.id} id={`item-${it.id}`} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="w-36 shrink-0 text-sm font-medium">{formatDate(it.startsAt)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("font-semibold", it.cancelled && "line-through")}>{it.title}</span>
                  <Badge className={KIND_COLORS[it.kind]}>{KIND_LABELS[it.kind]}</Badge>
                  {it.cancelled ? <Badge variant="destructive">Cancelled</Badge> : null}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <ClockIcon className="size-3.5" /> {formatTime(it.startsAt)} – {formatTime(it.endsAt)}
                  </span>
                  {it.location ? (
                    <span className="flex items-center gap-1">
                      <MapPinIcon className="size-3.5" /> {it.location}
                    </span>
                  ) : null}
                  {it.presenter ? (
                    <Link href={`/members/${it.presenter.id}`} className="flex items-center gap-1 text-primary">
                      <UserIcon className="size-3.5" /> {it.presenter.name}
                    </Link>
                  ) : null}
                </div>
                {it.description ? <p className="mt-1 text-sm whitespace-pre-line">{it.description}</p> : null}
                {it.link ? (
                  <a href={it.link} target="_blank" rel="noopener" className="mt-1 inline-block text-sm text-primary underline">
                    Link
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
