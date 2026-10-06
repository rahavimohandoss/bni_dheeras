import { count, desc, eq, lte, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { attendance, meeting, member } from "@/db/schema";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireMember } from "@/lib/session";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Attendance" };

const PAGE_SIZE = 20;
/** Counts only real chapter members (admin-only accounts are left out). */
const tally = (status: string) =>
  sql<number>`count(*) filter (where ${attendance.status} = ${status} and ${member.isChapterMember})::int`;

export default async function AttendanceAdminPage({ searchParams }: PageProps<"/admin/attendance">) {
  const me = await requireMember();
  if (!me.caps.has("palms.view") && !me.caps.has("meeting.finalize")) redirect("/?denied=1");
  const started = lte(meeting.checkinOpensAt, new Date());
  const [{ total }] = await db.select({ total: count() }).from(meeting).where(started);
  const { page, pageCount, offset } = paginate(pageFromParam((await searchParams).page), total, PAGE_SIZE);
  const rows = await db
    .select({ meeting, p: tally("P"), a: tally("A"), l: tally("L"), m: tally("M"), s: tally("S") })
    .from(meeting)
    .leftJoin(attendance, eq(attendance.meetingId, meeting.id))
    .leftJoin(member, eq(member.id, attendance.memberId))
    .where(started)
    .groupBy(meeting.id)
    .orderBy(desc(meeting.startsAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  return (
    <PageContainer wide>
      <PageHeader title="Attendance & PALMS" back={{ href: "/admin", label: "Admin" }} />
      {rows.length === 0 ? (
        <EmptyState title="No meetings yet." />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">P</TableHead>
                <TableHead className="text-right">A</TableHead>
                <TableHead className="text-right">L</TableHead>
                <TableHead className="text-right">M</TableHead>
                <TableHead className="text-right">S</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.meeting.id}>
                  <TableCell>
                    <div className="font-medium">{formatDate(r.meeting.startsAt)}</div>
                    <div className="text-xs text-muted-foreground">{r.meeting.title}</div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.meeting.status === "finalized" ? "secondary" : r.meeting.status === "cancelled" ? "destructive" : "outline"
                      }
                    >
                      {r.meeting.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.p}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.a}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.l}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.m}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.s}</TableCell>
                  <TableCell className="text-right">
                    {r.meeting.status === "cancelled" ? null : (
                      <Link className="text-sm text-primary underline" href={`/meetings/${r.meeting.id}/summary`}>
                        Summary
                      </Link>
                    )}
                    {r.meeting.status === "scheduled" ? (
                      <Link className="ml-3 text-sm text-primary underline" href={`/lvh/${r.meeting.id}`}>
                        Board
                      </Link>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} href={(p) => pageHref("/admin/attendance", {}, p)} />
    </PageContainer>
  );
}
