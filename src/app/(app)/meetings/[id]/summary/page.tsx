import { asc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VisitorCounter } from "@/components/visitor-counter";
import { db } from "@/db";
import { absenceFollowup, ATTENDANCE_STATUSES, type AttendanceStatus, member, visitor } from "@/db/schema";
import { getBoardData } from "@/lib/attendance/board";
import { getMeetingWithVenue } from "@/lib/attendance/queries";
import { requireMember } from "@/lib/session";
import { formatDate, formatDateTime, formatTime } from "@/lib/time";
import { ReopenMeetingButton } from "./reopen-button";
import { CopyPalmsButton, FollowupRow, PrintButton } from "./summary-client";

export const metadata: Metadata = { title: "PALMS summary" };

const METHOD: Record<string, string> = {
  self_qr: "QR scan",
  lvh_scan: "LVH pass scan",
  manual: "Manual",
  auto: "Auto (finalize)",
  substitute: "Substitute",
};

export default async function SummaryPage({ params }: PageProps<"/meetings/[id]/summary">) {
  const me = await requireMember();
  if (!me.caps.has("palms.view") && !me.caps.has("meeting.finalize")) notFound();
  const { id } = await params;
  const m = await getMeetingWithVenue(id);
  if (!m) notFound();
  const data = await getBoardData(m);
  const inviter = alias(member, "inviter");
  const [followups, visitors] = await Promise.all([
    db.select().from(absenceFollowup).where(eq(absenceFollowup.meetingId, m.id)),
    db
      .select({
        id: visitor.id,
        name: visitor.name,
        phone: visitor.phone,
        business: visitor.business,
        category: visitor.category,
        note: visitor.note,
        invitedBy: inviter.fullName,
      })
      .from(visitor)
      .leftJoin(inviter, eq(inviter.id, visitor.invitedById))
      .where(eq(visitor.meetingId, m.id))
      .orderBy(asc(visitor.createdAt)),
  ]);
  const canEditVisitors = me.caps.has("kiosk.run") || me.caps.has("meeting.finalize");
  const finalizedBy = m.finalizedById
    ? (await db.select({ name: member.fullName }).from(member).where(eq(member.id, m.finalizedById)))[0]?.name
    : null;

  const counts: Record<AttendanceStatus, number> = { P: 0, A: 0, L: 0, M: 0, S: 0 };
  for (const row of data.members) if (row.status) counts[row.status]++;
  const manualCount = data.members.filter((r) => r.method === "manual").length;
  const checkedIn = counts.P + counts.L;
  const rowsForCopy = data.members.map((r) => ({
    name: r.name,
    status: r.status ?? "-",
    substitute: r.substitute && r.status === "S" ? r.substitute.name : "",
  }));
  const absentees = data.members.filter((r) => r.status === "A");

  return (
    <PageContainer wide>
      <PageHeader
        title={`PALMS · ${formatDate(m.startsAt)}`}
        back={{ href: "/admin/attendance", label: "Attendance" }}
        description={
          m.status === "finalized"
            ? `${m.title} · finalized ${m.finalizedAt ? formatDateTime(m.finalizedAt) : ""}${finalizedBy ? ` by ${finalizedBy}` : ""}`
            : `${m.title} · not finalized yet (statuses may change)`
        }
        actions={
          <div className="no-print flex flex-wrap gap-2">
            {m.status === "finalized" && me.caps.has("meeting.finalize") ? <ReopenMeetingButton meetingId={m.id} /> : null}
            <CopyPalmsButton rows={rowsForCopy} />
            <Button asChild variant="outline">
              <a href={`/api/meetings/${m.id}/palms`}>
                <DownloadIcon /> CSV
              </a>
            </Button>
            <PrintButton />
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-7">
        {ATTENDANCE_STATUSES.map((s) => (
          <div key={s} className="rounded-xl border p-3">
            <StatusBadge status={s} />
            <div className="mt-1 text-2xl font-bold tabular-nums">{counts[s]}</div>
          </div>
        ))}
        <VisitorCounter
          key={data.visitors}
          meetingId={m.id}
          value={data.visitors}
          editable={me.caps.has("kiosk.run") || me.caps.has("meeting.finalize")}
        />
        <div className="rounded-xl border p-3">
          <div className="text-xs text-muted-foreground">Headcount</div>
          <div className="mt-1 text-2xl font-bold tabular-nums">{m.headcount ?? "–"}</div>
        </div>
      </div>

      {m.headcount !== null && m.headcount !== checkedIn ? (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Headcount ({m.headcount}) differs from app check-ins ({checkedIn}).
        </p>
      ) : null}
      {manualCount > 0 ? (
        <p className="mb-4 rounded-lg bg-muted p-3 text-sm">
          {manualCount} manual change(s) by the LVH team this meeting — see the &quot;How&quot; column.
        </p>
      ) : null}

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>How</TableHead>
              <TableHead>Substitute / note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.members.map((r, i) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground">{r.category}</div>
                </TableCell>
                <TableCell>{r.status ? <StatusBadge status={r.status} /> : <Badge variant="outline">–</Badge>}</TableCell>
                <TableCell className="tabular-nums">{r.at ? formatTime(new Date(r.at)) : ""}</TableCell>
                <TableCell>
                  {r.method ? (
                    <span className={r.method === "manual" ? "font-semibold text-amber-700" : ""}>{METHOD[r.method]}</span>
                  ) : null}
                  {r.flags.length ? <div className="text-xs text-amber-700">⚠ {r.flags.join(", ")}</div> : null}
                </TableCell>
                <TableCell className="max-w-64 text-sm whitespace-normal">
                  {r.substitute ? `${r.substitute.name}${r.substitute.arrived ? "" : " (not confirmed)"}` : ""}
                  {r.note ? <div className="text-muted-foreground">{r.note}</div> : null}
                  {r.leave && !r.substitute ? (
                    <div className="text-muted-foreground">
                      {r.leave.kind === "medical" ? `Medical leave (${r.leave.status})` : "Informed absence"}
                    </div>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data.visitors > 0 || visitors.length ? (
        <section className="mt-8">
          <h2 className="mb-1 font-semibold">Visitors ({data.visitors})</h2>
          <p className="no-print mb-3 text-sm text-muted-foreground">
            {visitors.length
              ? `Details taken for ${visitors.length} of ${data.visitors}.`
              : "No details taken yet."}
            {canEditVisitors ? (
              <>
                {" "}
                <Link className="text-primary underline" href={`/admin/meetings/${m.id}/visitors`}>
                  Add or edit visitor details
                </Link>
              </>
            ) : null}
          </p>
          {visitors.length ? (
            <div className="rounded-xl border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Mobile</TableHead>
                    <TableHead>Invited by</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visitors.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.name}</TableCell>
                      <TableCell>{v.business}</TableCell>
                      <TableCell>{v.category}</TableCell>
                      <TableCell className="tabular-nums">{v.phone}</TableCell>
                      <TableCell>{v.invitedBy}</TableCell>
                      <TableCell className="max-w-64 text-sm whitespace-normal">{v.note}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </section>
      ) : null}

      {m.status === "finalized" && absentees.length ? (
        <section className="no-print mt-8">
          <h2 className="mb-1 font-semibold">Absentee follow-up</h2>
          <p className="mb-3 text-sm text-muted-foreground">Call each absent member within 24 hours and tick them off.</p>
          <div className="divide-y rounded-xl border">
            {absentees.map((r) => {
              const f = followups.find((x) => x.memberId === r.id);
              return (
                <FollowupRow
                  key={r.id}
                  meetingId={m.id}
                  memberId={r.id}
                  name={r.name}
                  phone={r.phone}
                  called={!!f?.calledAt}
                  note={f?.note ?? ""}
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </PageContainer>
  );
}
