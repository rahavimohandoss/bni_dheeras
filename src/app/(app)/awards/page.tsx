import { and, asc, count, countDistinct, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { TrophyIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MemberAvatar } from "@/components/member-avatar";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { award, awardType, meeting, member, term } from "@/db/schema";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireMember } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import { formatDate, istToDate, toIstDateInput } from "@/lib/time";

export const metadata: Metadata = { title: "Recognitions" };

const WEEKS_PER_PAGE = 6;

export default async function AwardsPage({ searchParams }: PageProps<"/awards">) {
  await requireMember();
  const published = eq(award.published, true);
  const [{ total }] = await db.select({ total: countDistinct(award.meetingId) }).from(award).where(published);
  const { page, pageCount, offset } = paginate(pageFromParam((await searchParams).page), total, WEEKS_PER_PAGE);

  // This page's weeks, newest first, then their winners.
  const weekList = await db
    .selectDistinct({ id: meeting.id, date: meeting.startsAt })
    .from(award)
    .innerJoin(meeting, eq(meeting.id, award.meetingId))
    .where(published)
    .orderBy(desc(meeting.startsAt))
    .limit(WEEKS_PER_PAGE)
    .offset(offset);
  const weekIds = weekList.map((w) => w.id);
  const rows = weekIds.length
    ? await db
        .select({
          meetingId: award.meetingId,
          award: awardType.name,
          memberId: member.id,
          name: member.fullName,
          photoKey: member.photoKey,
          note: award.note,
          value: award.value,
        })
        .from(award)
        .innerJoin(awardType, eq(awardType.id, award.awardTypeId))
        .innerJoin(member, eq(member.id, award.memberId))
        .where(and(published, inArray(award.meetingId, weekIds)))
        .orderBy(asc(awardType.sortOrder))
    : [];
  const weeks = weekList.map((w) => ({ ...w, items: rows.filter((r) => r.meetingId === w.id) }));

  // The leaderboard counts every published win this term, whatever page is shown.
  const today = toIstDateInput(new Date());
  const [current] = await db.select().from(term).where(and(lte(term.startsOn, today), gte(term.endsOn, today)));
  const wins = count();
  const leaders = await db
    .select({ memberId: member.id, name: member.fullName, photoKey: member.photoKey, wins })
    .from(award)
    .innerJoin(meeting, eq(meeting.id, award.meetingId))
    .innerJoin(member, eq(member.id, award.memberId))
    .where(current ? and(published, gte(meeting.startsAt, istToDate(current.startsOn))) : published)
    .groupBy(member.id, member.fullName, member.photoKey)
    .orderBy(desc(wins), asc(member.fullName))
    .limit(10);

  return (
    <PageContainer wide>
      <PageHeader title="Weekly recognitions" description="Chosen each week by the Head Table." />
      {total === 0 ? (
        <EmptyState title="No recognitions published yet." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {weeks.map((w) => (
              <Card key={w.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{formatDate(w.date)}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  {w.items.map((r) => (
                    <Link key={r.award} href={`/members/${r.memberId}`} className="flex items-center gap-3">
                      <MemberAvatar name={r.name} src={publicUrl(r.photoKey)} />
                      <div className="min-w-0 text-sm">
                        <div className="text-xs text-muted-foreground">{r.award}</div>
                        <div className="truncate font-medium">{r.name}</div>
                        {r.value || r.note ? (
                          <div className="truncate text-xs text-muted-foreground">{[r.value, r.note].filter(Boolean).join(" · ")}</div>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            ))}
            <Pagination
              page={page}
              pageCount={pageCount}
              total={total}
              pageSize={WEEKS_PER_PAGE}
              href={(p) => pageHref("/awards", {}, p)}
            />
          </div>
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrophyIcon className="size-4 text-primary" /> {current ? `${current.name} leaderboard` : "Leaderboard"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {leaders.map((l, i) => (
                <div key={l.memberId} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
                  <MemberAvatar name={l.name} src={publicUrl(l.photoKey)} className="size-8" />
                  <span className="flex-1 truncate">{l.name}</span>
                  <span className="font-semibold tabular-nums">{l.wins}</span>
                </div>
              ))}
              {leaders.length === 0 ? <p className="text-sm text-muted-foreground">No wins yet this term.</p> : null}
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
