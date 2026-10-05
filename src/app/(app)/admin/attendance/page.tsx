import { desc, eq, lte, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { attendance, meeting } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { formatDate } from "@/lib/time";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Attendance" };

export default async function AttendanceAdminPage() {
  const me = await requireMember();
  if (!me.caps.has("palms.view") && !me.caps.has("meeting.finalize")) redirect("/?denied=1");
  const rows = await db
    .select({
      meeting,
      p: sql<number>`count(*) filter (where ${attendance.status} = 'P')::int`,
      l: sql<number>`count(*) filter (where ${attendance.status} = 'L')::int`,
      a: sql<number>`count(*) filter (where ${attendance.status} = 'A')::int`,
      m: sql<number>`count(*) filter (where ${attendance.status} = 'M')::int`,
      s: sql<number>`count(*) filter (where ${attendance.status} = 'S')::int`,
    })
    .from(meeting)
    .leftJoin(attendance, eq(attendance.meetingId, meeting.id))
    .where(lte(meeting.checkinOpensAt, new Date()))
    .groupBy(meeting.id)
    .orderBy(desc(meeting.startsAt))
    .limit(60);

  return (
    <PageContainer wide>
      <PageHeader
        title="Attendance & PALMS"
        back={{ href: "/admin", label: "Admin" }}
        description="Open a meeting for its PALMS summary, the copy for BNI Connect and absentee follow-ups."
      />
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
                <TableHead className="text-right">L</TableHead>
                <TableHead className="text-right">A</TableHead>
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
                    <Badge variant={r.meeting.status === "finalized" ? "secondary" : "outline"}>{r.meeting.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.p}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.l}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.a}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.m}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.s}</TableCell>
                  <TableCell className="text-right">
                    <Link className="text-sm text-primary underline" href={`/meetings/${r.meeting.id}/summary`}>
                      Summary
                    </Link>
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
    </PageContainer>
  );
}
