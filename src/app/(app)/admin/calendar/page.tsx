import { and, asc, eq, gte } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { CALENDAR_KINDS, type CalendarKind, calendarEvent, member } from "@/db/schema";
import { canManageKind } from "@/lib/calendar-perms";
import { KIND_LABELS } from "@/lib/calendar";
import { requireMember } from "@/lib/session";
import { daysFromNow, toIstDateInput, toIstTimeInput } from "@/lib/time";
import { CalendarAdmin } from "./calendar-admin";

export const metadata: Metadata = { title: "Manage calendar" };

export default async function CalendarAdminPage() {
  const me = await requireMember();
  const kinds: CalendarKind[] = [];
  for (const k of CALENDAR_KINDS) if (canManageKind(me, k)) kinds.push(k);
  if (kinds.length === 0) redirect("/?denied=1");

  const [events, members] = await Promise.all([
    db
      .select()
      .from(calendarEvent)
      .where(gte(calendarEvent.endsAt, daysFromNow(-7)))
      .orderBy(asc(calendarEvent.startsAt))
      .limit(100),
    db.select({ id: member.id, name: member.fullName }).from(member).where(and(eq(member.status, "active"), eq(member.isChapterMember, true))).orderBy(asc(member.fullName)),
  ]);

  return (
    <PageContainer>
      <PageHeader
        title="Manage calendar"
        back={{ href: "/admin", label: "Admin" }}
        description="Weekly meetings appear automatically. Add events, trainings and presentation slots here."
      />
      <CalendarAdmin
        kinds={kinds.map((k) => ({ key: k, label: KIND_LABELS[k] }))}
        members={members}
        events={events
          .filter((e) => kinds.includes(e.kind))
          .map((e) => ({
            id: e.id,
            kind: e.kind,
            title: e.title,
            description: e.description ?? "",
            date: toIstDateInput(e.startsAt),
            startTime: toIstTimeInput(e.startsAt),
            endTime: toIstTimeInput(e.endsAt),
            location: e.location ?? "",
            link: e.link ?? "",
            memberId: e.memberId ?? "",
          }))}
      />
    </PageContainer>
  );
}
