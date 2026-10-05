import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { TrophyIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MemberAvatar } from "@/components/member-avatar";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { award, awardType, meeting, member, term } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import { formatDate, istToDate, toIstDateInput } from "@/lib/time";

export const metadata: Metadata = { title: "Recognitions" };

export default async function AwardsPage() {
  await requireMember();
  const rows = await db
    .select({
      meetingId: meeting.id,
      date: meeting.startsAt,
      award: awardType.name,
      sort: awardType.sortOrder,
      memberId: member.id,
      name: member.fullName,
      photoKey: member.photoKey,
      note: award.note,
      value: award.value,
    })
    .from(award)
    .innerJoin(meeting, eq(meeting.id, award.meetingId))
    .innerJoin(awardType, eq(awardType.id, award.awardTypeId))
    .innerJoin(member, eq(member.id, award.memberId))
    .where(eq(award.published, true))
    .orderBy(desc(meeting.startsAt), asc(awardType.sortOrder))
    .limit(300);

  const today = toIstDateInput(new Date());
  const [current] = await db.select().from(term).where(and(lte(term.startsOn, today), gte(term.endsOn, today)));
  const termStart = current ? istToDate(current.startsOn) : null;
  const tally = new Map<string, { name: string; photoKey: string | null; wins: number }>();
  for (const r of rows) {
    if (termStart && r.date < termStart) continue;
    const t = tally.get(r.memberId) ?? { name: r.name, photoKey: r.photoKey, wins: 0 };
    t.wins++;
    tally.set(r.memberId, t);
  }
  const leaders = [...tally.entries()].sort((a, b) => b[1].wins - a[1].wins).slice(0, 10);

  const weeks = new Map<string, { date: Date; items: typeof rows }>();
  for (const r of rows) {
    const w = weeks.get(r.meetingId) ?? { date: r.date, items: [] };
    w.items.push(r);
    weeks.set(r.meetingId, w);
  }

  return (
    <PageContainer wide>
      <PageHeader title="Weekly recognitions" description="Chosen each week by the Head Table." />
      {rows.length === 0 ? (
        <EmptyState title="No recognitions published yet." />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {[...weeks.values()].map((w) => (
              <Card key={w.date.toISOString()}>
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
          </div>
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrophyIcon className="size-4 text-primary" /> {current ? `${current.name} leaderboard` : "Leaderboard"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {leaders.map(([id, l], i) => (
                <div key={id} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
                  <MemberAvatar name={l.name} src={publicUrl(l.photoKey)} className="size-8" />
                  <span className="flex-1 truncate">{l.name}</span>
                  <span className="font-semibold tabular-nums">{l.wins}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
