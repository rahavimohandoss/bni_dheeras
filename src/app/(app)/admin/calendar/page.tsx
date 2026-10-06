import { and, asc, count, eq, gte, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { db } from "@/db";
import { CALENDAR_KINDS, type CalendarKind, calendarEvent, member } from "@/db/schema";
import { canManageKind } from "@/lib/calendar-perms";
import { KIND_LABELS } from "@/lib/calendar";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireMember } from "@/lib/session";
import { daysFromNow, toIstDateInput, toIstTimeInput } from "@/lib/time";
import { CalendarAdmin } from "./calendar-admin";

export const metadata: Metadata = { title: "Manage calendar" };

const PAGE_SIZE = 15;

export default async function CalendarAdminPage({ searchParams }: PageProps<"/admin/calendar">) {
  const me = await requireMember();
  const kinds: CalendarKind[] = [];
  for (const k of CALENDAR_KINDS) if (canManageKind(me, k)) kinds.push(k);
  if (kinds.length === 0) redirect("/?denied=1");

  // Upcoming items (and last week's) of the kinds this person manages.
  const shown = and(gte(calendarEvent.endsAt, daysFromNow(-7)), inArray(calendarEvent.kind, kinds));
  const [{ total }] = await db.select({ total: count() }).from(calendarEvent).where(shown);
  const { page, pageCount, offset } = paginate(pageFromParam((await searchParams).page), total, PAGE_SIZE);
  const [events, members] = await Promise.all([
    db.select().from(calendarEvent).where(shown).orderBy(asc(calendarEvent.startsAt)).limit(PAGE_SIZE).offset(offset),
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
        events={events.map((e) => ({
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
      <Pagination
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={PAGE_SIZE}
        href={(p) => pageHref("/admin/calendar", {}, p)}
      />
    </PageContainer>
  );
}
