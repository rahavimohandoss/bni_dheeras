import { count, desc, eq, lte, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { clearMeetingAttendance } from "@/actions/meetings";
import { ConfirmButton } from "@/components/confirm-button";
import { DeleteMeetingButton } from "@/components/delete-meeting-button";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { attendance, meeting, member } from "@/db/schema";
import { recordCounts } from "@/lib/attendance/queries";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireMember } from "@/lib/session";
import { formatDate, formatTime } from "@/lib/time";

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
  const counts = await recordCounts(rows.map((r) => r.meeting.id));
  // Clearing PALMS (the meeting stays) is PALMS history: President or admin only.
  const canClear = (status: string, records: number) => me.fullAccess && (records > 0 || status === "finalized");
  const canEditMeeting = me.caps.has("meetings.manage");

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
                    {canEditMeeting ? (
                      <Link href={`/admin/meetings/${r.meeting.id}`} className="font-medium hover:underline">
                        {formatDate(r.meeting.startsAt)}
                      </Link>
                    ) : (
                      <div className="font-medium">{formatDate(r.meeting.startsAt)}</div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {formatTime(r.meeting.startsAt)} · {r.meeting.title}
                    </div>
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
                  <TableCell className="text-right whitespace-nowrap">
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
                    {canClear(r.meeting.status, counts.get(r.meeting.id)!.records) ? (
                      <span className="ml-1">
                        <ConfirmButton
                          label="Clear PALMS"
                          title={`Clear the PALMS for ${formatDate(r.meeting.startsAt)}?`}
                          description={clearDescription(counts.get(r.meeting.id)!.records, r.meeting.status === "finalized")}
                          success="PALMS cleared. The meeting is still on the schedule."
                          action={clearMeetingAttendance.bind(null, r.meeting.id)}
                          requireReason="Reason (e.g. test check-ins)"
                        />
                      </span>
                    ) : null}
                    {canEditMeeting ? (
                      <DeleteMeetingButton
                        meetingId={r.meeting.id}
                        when={`${formatDate(r.meeting.startsAt)} · ${formatTime(r.meeting.startsAt)}`}
                        {...counts.get(r.meeting.id)!}
                        finalized={r.meeting.status === "finalized"}
                        size="sm"
                      />
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

function clearDescription(records: number, finalized: boolean) {
  const what = records === 1 ? "1 attendance record" : `${records} attendance records`;
  return (
    `This removes the PALMS (${what}), the check-in log, follow-ups, the visitor count and the headcount` +
    `${finalized ? ", and opens the meeting again" : ""}. The meeting stays on the schedule, so attendance can be taken again. ` +
    "Recognitions aren't touched. The audit log keeps a copy."
  );
}
