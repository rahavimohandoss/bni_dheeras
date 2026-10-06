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
import { deleteMeeting, restoreMeeting } from "@/actions/meetings";
import { ConfirmButton } from "@/components/confirm-button";
import { CancelMeetingButton } from "./cancel-button";
import { MeetingForm } from "../meeting-form";

export const metadata: Metadata = { title: "Edit meeting" };

export default async function EditMeetingPage({ params }: PageProps<"/admin/meetings/[id]">) {
  await requireCapPage("meetings.manage");
  const { id } = await params;
  const [m] = await db.select().from(meeting).where(eq(meeting.id, id));
  if (!m) notFound();
  const venues = await db.select({ id: venue.id, name: venue.name }).from(venue).where(eq(venue.isActive, true));
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
            {m.status === "cancelled" && m.endsAt > new Date() ? (
              <ConfirmButton
                label="Restore"
                title="Restore this meeting?"
                description="It goes back on the schedule and check-in opens as usual."
                success="Meeting restored."
                action={restoreMeeting.bind(null, m.id)}
                variant="outline"
                size="default"
                destructive={false}
              />
            ) : null}
            {m.status !== "finalized" ? (
              <ConfirmButton
                label="Delete"
                title="Delete this meeting?"
                description="Only for meetings created by mistake. A meeting with check-ins or recognitions can only be cancelled."
                success="Meeting deleted."
                action={deleteMeeting.bind(null, m.id)}
                redirectTo="/admin/meetings"
                variant="outline"
                size="default"
              />
            ) : null}
          </>
        }
      />
      {m.status !== "scheduled" ? (
        <p className="rounded-lg bg-muted p-3 text-sm">
          This meeting is {m.status} and can no longer be edited.
          {m.status === "cancelled" && m.notes ? <> Reason: {m.notes}</> : null}
        </p>
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
