import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { meeting, venue } from "@/db/schema";
import { recordCounts } from "@/lib/attendance/queries";
import { requireCapPage } from "@/lib/session";
import { formatDate, formatTime, toIstDateInput, toIstTimeInput } from "@/lib/time";
import { restoreMeeting } from "@/actions/meetings";
import { ConfirmButton } from "@/components/confirm-button";
import { DeleteMeetingButton } from "@/components/delete-meeting-button";
import { CancelMeetingButton } from "./cancel-button";
import { MeetingForm } from "../meeting-form";

export const metadata: Metadata = { title: "Edit meeting" };

export default async function EditMeetingPage({ params }: PageProps<"/admin/meetings/[id]">) {
  const me = await requireCapPage("meetings.manage");
  const { id } = await params;
  const [m] = await db.select().from(meeting).where(eq(meeting.id, id));
  if (!m) notFound();
  const [venues, counts] = await Promise.all([
    db.select({ id: venue.id, name: venue.name }).from(venue).where(eq(venue.isActive, true)),
    recordCounts([m.id]).then((c) => c.get(m.id)!),
  ]);
  const opensBefore = Math.round((m.startsAt.getTime() - m.checkinOpensAt.getTime()) / 60_000);

  return (
    <PageContainer>
      <PageHeader
        title={`${m.title} · ${formatDate(m.startsAt)}, ${formatTime(m.startsAt)}`}
        back={{ href: "/admin/meetings", label: "Meetings" }}
        actions={
          <>
            {m.status !== "cancelled" && me.caps.has("attendance.manual") ? (
              <Button asChild>
                <Link href={`/admin/meetings/${m.id}/palms`}>Enter PALMS</Link>
              </Button>
            ) : null}
            {m.status !== "cancelled" && (me.caps.has("kiosk.run") || me.caps.has("meeting.finalize")) ? (
              <Button asChild variant="outline">
                <Link href={`/admin/meetings/${m.id}/visitors`}>
                  Visitors{m.visitorCount ? ` · ${m.visitorCount}` : ""}
                </Link>
              </Button>
            ) : null}
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
            <DeleteMeetingButton
              meetingId={m.id}
              when={`${formatDate(m.startsAt)} · ${formatTime(m.startsAt)}`}
              {...counts}
              finalized={m.status === "finalized"}
              redirectTo="/admin/meetings"
              variant="outline"
            />
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
