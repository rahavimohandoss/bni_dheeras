import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { meeting, venue } from "@/db/schema";
import { requireCapPage } from "@/lib/session";
import { formatDate, toIstDateInput, toIstTimeInput } from "@/lib/time";
import { CancelMeetingButton } from "./cancel-button";
import { MeetingForm } from "../meeting-form";

export const metadata: Metadata = { title: "Edit meeting" };

export default async function EditMeetingPage({ params }: PageProps<"/admin/meetings/[id]">) {
  await requireCapPage("meetings.manage");
  const { id } = await params;
  const [m] = await db.select().from(meeting).where(eq(meeting.id, id));
  if (!m) notFound();
  const venues = await db
    .select({ id: venue.id, name: venue.name, geofenceM: venue.geofenceM })
    .from(venue)
    .where(eq(venue.isActive, true));
  const opensBefore = Math.round((m.startsAt.getTime() - m.checkinOpensAt.getTime()) / 60_000);

  return (
    <PageContainer>
      <PageHeader
        title={`${m.title} · ${formatDate(m.startsAt)}`}
        back={{ href: "/admin/meetings", label: "Meetings" }}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/lvh/${m.id}`}>Live board</Link>
            </Button>
            {m.status === "scheduled" ? <CancelMeetingButton id={m.id} /> : null}
          </>
        }
      />
      {m.status !== "scheduled" ? (
        <p className="rounded-lg bg-muted p-3 text-sm">This meeting is {m.status} and can no longer be edited.</p>
      ) : (
        <Card>
          <CardContent className="py-4">
            <MeetingForm
              mode="edit"
              meetingId={m.id}
              venues={venues}
              initial={{
                title: m.title,
                kind: m.kind,
                mode: m.mode,
                venueId: m.venueId ?? "",
                date: toIstDateInput(m.startsAt),
                startTime: toIstTimeInput(m.startsAt),
                endTime: toIstTimeInput(m.endsAt),
                graceMinutes: m.graceMinutes === null ? "" : String(m.graceMinutes),
                geofenceM: m.geofenceM === null ? "" : String(m.geofenceM),
                opensBeforeMin: String(opensBefore),
                weeks: "1",
              }}
            />
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
