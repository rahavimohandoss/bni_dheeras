import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { attendance } from "@/db/schema";
import { getBoardData } from "@/lib/attendance/board";
import { getMeetingWithVenue } from "@/lib/attendance/queries";
import { requireCapPage } from "@/lib/session";
import { formatDate, formatTime } from "@/lib/time";
import { PalmsSheet } from "./palms-sheet";

export const metadata: Metadata = { title: "Enter PALMS" };

export default async function EnterPalmsPage({ params }: PageProps<"/admin/meetings/[id]/palms">) {
  await requireCapPage("attendance.manual");
  const { id } = await params;
  const m = await getMeetingWithVenue(id);
  if (!m) notFound();
  const [data, recorded] = await Promise.all([
    getBoardData(m),
    db.select({ memberId: attendance.memberId }).from(attendance).where(eq(attendance.meetingId, m.id)),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title={`Enter PALMS · ${formatDate(m.startsAt)}`}
        back={{ href: `/admin/meetings/${m.id}`, label: "Meeting" }}
        description={`${m.title} · ${formatTime(m.startsAt)}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/meetings/${m.id}/summary`}>PALMS summary</Link>
          </Button>
        }
      />
      {m.status === "finalized" ? (
        <p className="rounded-lg bg-muted p-4 text-sm">
          This meeting is finalized, so its PALMS is locked. To change it, open the{" "}
          <Link className="text-primary underline" href={`/meetings/${m.id}/summary`}>
            PALMS summary
          </Link>{" "}
          and use <b>Reopen for corrections</b>.
        </p>
      ) : m.status === "cancelled" ? (
        <p className="rounded-lg bg-muted p-4 text-sm">This meeting was cancelled, so there is no PALMS to enter.</p>
      ) : (
        <PalmsSheet
          meetingId={m.id}
          hasRecords={recorded.length > 0}
          members={data.members.map((r) => ({
            id: r.id,
            name: r.name,
            category: r.category,
            status: r.status ?? "",
            method: r.method,
            at: r.at,
            substitute: r.substitute?.name ?? null,
            leave: r.leave && r.leave.status === "approved" ? r.leave.kind : null,
          }))}
        />
      )}
    </PageContainer>
  );
}
