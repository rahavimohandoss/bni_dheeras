import { and, asc, eq, gte } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from "@/db";
import { meeting, venue } from "@/db/schema";
import { requireCapPage } from "@/lib/session";
import { getAttendanceSettings } from "@/lib/settings";
import { addDays, formatDateTime, formatTime, istWeekday, toIstDateInput } from "@/lib/time";
import { MeetingForm, type MeetingFormValues } from "./meeting-form";

export const metadata: Metadata = { title: "Meetings" };

export default async function MeetingsAdminPage() {
  await requireCapPage("meetings.manage");
  const [upcoming, venues, settings] = await Promise.all([
    db
      .select({ meeting, venueName: venue.name })
      .from(meeting)
      .leftJoin(venue, eq(venue.id, meeting.venueId))
      .where(and(gte(meeting.endsAt, new Date()), eq(meeting.status, "scheduled")))
      .orderBy(asc(meeting.startsAt))
      .limit(30),
    db.select({ id: venue.id, name: venue.name, geofenceM: venue.geofenceM }).from(venue).where(eq(venue.isActive, true)),
    getAttendanceSettings(),
  ]);

  // Default the series to the weekday/time of the next scheduled meeting, else next Thursday 7 AM.
  const last = upcoming.at(-1)?.meeting;
  const nextDate = last ? addDays(last.startsAt, 7) : nextWeekday(4);
  const defaults: MeetingFormValues = {
    title: "Weekly Meeting",
    kind: "weekly",
    mode: "in_person",
    venueId: venues[0]?.id ?? "",
    date: toIstDateInput(nextDate),
    startTime: last ? toTime(last.startsAt) : "07:00",
    endTime: last ? toTime(last.endsAt) : "08:30",
    graceMinutes: settings.defaultGraceMinutes === null ? "" : String(settings.defaultGraceMinutes),
    geofenceM: "",
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
            <div className="space-y-2">
              {upcoming.map(({ meeting: m, venueName }) => (
                <Link key={m.id} href={`/admin/meetings/${m.id}`}>
                  <Card className="mb-2 hover:border-primary/40">
                    <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div>
                        <div className="font-medium">{m.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatDateTime(m.startsAt)} – {formatTime(m.endsAt)} ·{" "}
                          {m.mode === "online" ? "Online" : (venueName ?? "No venue")}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Badge variant="secondary">
                          {m.graceMinutes === null ? "Late after exact start" : `Grace ${m.graceMinutes} min`}
                        </Badge>
                        {m.geofenceM ? <Badge variant="outline">{m.geofenceM} m</Badge> : null}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
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
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }).format(d);
}

function nextWeekday(target: number) {
  let d = addDays(new Date(), 1);
  while (istWeekday(d) !== target) d = addDays(d, 1);
  return d;
}
