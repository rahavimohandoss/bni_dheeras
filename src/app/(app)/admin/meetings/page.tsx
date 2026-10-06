import { and, asc, count, desc, eq, gte } from "drizzle-orm";
import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { restoreMeeting } from "@/actions/meetings";
import { ConfirmButton } from "@/components/confirm-button";
import { DeleteMeetingButton } from "@/components/delete-meeting-button";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import { meeting, venue } from "@/db/schema";
import { recordCounts } from "@/lib/attendance/queries";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireCapPage } from "@/lib/session";
import { getAttendanceSettings } from "@/lib/settings";
import { addDays, formatDate, formatDateTime, formatTime, istWeekday, toIstDateInput } from "@/lib/time";
import { MeetingForm, type MeetingFormValues } from "./meeting-form";

export const metadata: Metadata = { title: "Meetings" };

const PAGE_SIZE = 10;

export default async function MeetingsAdminPage({ searchParams }: PageProps<"/admin/meetings">) {
  const me = await requireCapPage("meetings.manage");
  const now = new Date();
  const isUpcoming = and(gte(meeting.endsAt, now), eq(meeting.status, "scheduled"));
  const [{ total }] = await db.select({ total: count() }).from(meeting).where(isUpcoming);
  const { page, pageCount, offset } = paginate(pageFromParam((await searchParams).page), total, PAGE_SIZE);
  const [upcoming, cancelled, [last], venues, settings] = await Promise.all([
    db
      .select({ meeting, venueName: venue.name })
      .from(meeting)
      .leftJoin(venue, eq(venue.id, meeting.venueId))
      .where(isUpcoming)
      .orderBy(asc(meeting.startsAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ meeting, venueName: venue.name })
      .from(meeting)
      .leftJoin(venue, eq(venue.id, meeting.venueId))
      .where(and(gte(meeting.endsAt, now), eq(meeting.status, "cancelled")))
      .orderBy(asc(meeting.startsAt))
      .limit(30),
    // The latest weekly meeting on the schedule, to continue the series from.
    db
      .select({ startsAt: meeting.startsAt, endsAt: meeting.endsAt })
      .from(meeting)
      .where(and(isUpcoming, eq(meeting.kind, "weekly")))
      .orderBy(desc(meeting.startsAt))
      .limit(1),
    db.select({ id: venue.id, name: venue.name }).from(venue).where(eq(venue.isActive, true)),
    getAttendanceSettings(),
  ]);
  const cancelledCounts = await recordCounts(cancelled.map((c) => c.meeting.id));

  // Default the series to the week after the last scheduled weekly meeting, else next Thursday 7 AM.
  const nextDate = last ? addDays(last.startsAt, 7) : nextWeekday(4);
  const defaults: MeetingFormValues = {
    title: "Weekly Meeting",
    kind: "weekly",
    mode: "in_person",
    venueId: venues[0]?.id ?? "",
    date: toIstDateInput(nextDate),
    startTime: last ? toTime(last.startsAt) : "07:00",
    endTime: last ? toTime(last.endsAt) : "08:30",
    opensBeforeMin: String(settings.checkinOpensBeforeMin),
    weeks: "8",
  };

  return (
    <PageContainer>
      <PageHeader title="Meetings" back={{ href: "/admin", label: "Admin" }} />
      {venues.length === 0 ? (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Add a venue first under <Link className="underline" href="/admin/venues">Venues</Link>.
        </p>
      ) : null}
      <Tabs defaultValue="upcoming">
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="weekly">Weekly series</TabsTrigger>
          <TabsTrigger value="single">One meeting</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          {upcoming.length === 0 ? (
            <EmptyState title="No upcoming meetings.">Create a weekly series to get started.</EmptyState>
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              {upcoming.map(({ meeting: m, venueName }) => (
                <Link
                  key={m.id}
                  href={`/admin/meetings/${m.id}`}
                  className="flex items-center gap-3 px-4 py-3 first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{m.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatDateTime(m.startsAt)} – {formatTime(m.endsAt)} ·{" "}
                      {m.mode === "online" ? "Online" : (venueName ?? "No venue")}
                    </div>
                  </div>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          )}
          <Pagination
            page={page}
            pageCount={pageCount}
            total={total}
            pageSize={PAGE_SIZE}
            href={(p) => pageHref("/admin/meetings", {}, p)}
          />
          {cancelled.length ? (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Cancelled</h2>
              <div className="divide-y rounded-xl border bg-card">
                {cancelled.map(({ meeting: m, venueName }) => (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <div className="font-medium line-through decoration-muted-foreground/60">{m.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatDateTime(m.startsAt)} · {m.mode === "online" ? "Online" : (venueName ?? "No venue")}
                        {m.notes ? ` · ${m.notes}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <ConfirmButton
                        label="Restore"
                        title="Restore this meeting?"
                        description="It goes back on the schedule and check-in opens as usual."
                        success="Meeting restored."
                        action={restoreMeeting.bind(null, m.id)}
                        destructive={false}
                      />
                      {me.fullAccess || cancelledCounts.get(m.id)!.records === 0 ? (
                        <DeleteMeetingButton
                          meetingId={m.id}
                          when={formatDate(m.startsAt)}
                          {...cancelledCounts.get(m.id)!}
                          finalized={false}
                          size="sm"
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </TabsContent>
        <TabsContent value="weekly">
          <Card>
            <CardContent className="py-4">
              <MeetingForm mode="weekly" venues={venues} initial={defaults} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="single">
          <Card>
            <CardContent className="py-4">
              <MeetingForm mode="single" venues={venues} initial={{ ...defaults, kind: "event", title: "" }} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

function toTime(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function nextWeekday(target: number) {
  let d = addDays(new Date(), 1);
  while (istWeekday(d) !== target) d = addDays(d, 1);
  return d;
}
