import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { meeting, member, visitor } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { formatDate, formatTime } from "@/lib/time";
import { VisitorsForm } from "./visitors-form";

export const metadata: Metadata = { title: "Visitors" };

export default async function VisitorsPage({ params }: PageProps<"/admin/meetings/[id]/visitors">) {
  const me = await requireMember();
  if (!me.caps.has("kiosk.run") && !me.caps.has("meeting.finalize")) redirect("/?denied=1");
  const { id } = await params;
  const [m] = await db.select().from(meeting).where(eq(meeting.id, id));
  if (!m) notFound();
  const [rows, members] = await Promise.all([
    db.select().from(visitor).where(eq(visitor.meetingId, m.id)).orderBy(asc(visitor.createdAt)),
    db
      .select({ id: member.id, name: member.fullName })
      .from(member)
      .where(and(eq(member.status, "active"), eq(member.isChapterMember, true)))
      .orderBy(asc(member.fullName)),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title={`Visitors · ${formatDate(m.startsAt)}`}
        back={{ href: `/admin/meetings/${m.id}`, label: "Meeting" }}
        description={`${m.title} · ${formatTime(m.startsAt)}. The count goes into PALMS; fill in the details you have.`}
      />
      <VisitorsForm
        meetingId={m.id}
        count={m.visitorCount ?? 0}
        members={members}
        visitors={rows.map((v) => ({
          name: v.name,
          phone: v.phone ?? "",
          business: v.business ?? "",
          category: v.category ?? "",
          invitedById: v.invitedById ?? "",
          note: v.note ?? "",
        }))}
      />
    </PageContainer>
  );
}
