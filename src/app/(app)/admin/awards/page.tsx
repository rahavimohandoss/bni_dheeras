import { and, asc, desc, eq, lte, ne } from "drizzle-orm";
import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { award, awardType, meeting, member } from "@/db/schema";
import { ensureDefaults } from "@/lib/defaults";
import { requireCapPage } from "@/lib/session";
import { daysFromNow, formatDate } from "@/lib/time";
import { AwardsEditor } from "./awards-editor";

export const metadata: Metadata = { title: "Weekly recognitions" };

export default async function AwardsAdminPage({ searchParams }: PageProps<"/admin/awards">) {
  await requireCapPage("awards.manage");
  await ensureDefaults();
  const meetings = await db
    .select({ id: meeting.id, title: meeting.title, startsAt: meeting.startsAt })
    .from(meeting)
    .where(and(lte(meeting.startsAt, daysFromNow(1)), ne(meeting.status, "cancelled")))
    .orderBy(desc(meeting.startsAt))
    .limit(12);
  const relevant = meetings;
  const { meeting: meetingParam } = await searchParams;
  const selected = relevant.find((m) => m.id === meetingParam) ?? relevant[0];

  const [types, members, existing] = await Promise.all([
    db.select().from(awardType).where(eq(awardType.isActive, true)).orderBy(asc(awardType.sortOrder)),
    db.select({ id: member.id, name: member.fullName }).from(member).where(ne(member.status, "inactive")).orderBy(asc(member.fullName)),
    selected ? db.select().from(award).where(eq(award.meetingId, selected.id)) : Promise.resolve([]),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Weekly recognitions"
        back={{ href: "/admin", label: "Admin" }}
        description="Head Table picks this week's winners. Save a draft during the meeting, publish when announced."
      />
      {selected ? (
        <AwardsEditor
          key={selected.id}
          meetings={relevant.map((m) => ({ id: m.id, label: `${formatDate(m.startsAt)} · ${m.title}` }))}
          meetingId={selected.id}
          types={types.map((t) => ({ id: t.id, name: t.name }))}
          members={members}
          initial={existing.map((e) => ({
            awardTypeId: e.awardTypeId,
            memberId: e.memberId,
            note: e.note ?? "",
            value: e.value ?? "",
            published: e.published,
          }))}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Create a meeting first.</p>
      )}
    </PageContainer>
  );
}
