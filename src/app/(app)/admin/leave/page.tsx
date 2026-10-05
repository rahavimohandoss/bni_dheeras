import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { leaveRequest, meeting, member } from "@/db/schema";
import { requireCapPage } from "@/lib/session";
import { formatDate } from "@/lib/time";
import { LeaveDecision } from "./leave-decision";

export const metadata: Metadata = { title: "Medical leave" };

export default async function LeavePage() {
  await requireCapPage("leave.approve");
  const rows = await db
    .select({ leave: leaveRequest, name: member.fullName, meetingTitle: meeting.title, startsAt: meeting.startsAt })
    .from(leaveRequest)
    .innerJoin(member, eq(member.id, leaveRequest.memberId))
    .innerJoin(meeting, eq(meeting.id, leaveRequest.meetingId))
    .where(eq(leaveRequest.kind, "medical"))
    .orderBy(desc(leaveRequest.createdAt))
    .limit(100);
  const pending = rows.filter((r) => r.leave.status === "pending");
  const decided = rows.filter((r) => r.leave.status !== "pending");

  return (
    <PageContainer>
      <PageHeader
        title="Medical leave"
        back={{ href: "/admin", label: "Admin" }}
        description="Approved medical leave is recorded as M (not an absence) when the meeting is finalized."
      />
      {pending.length === 0 ? (
        <EmptyState title="No pending requests." />
      ) : (
        <div className="space-y-2">
          {pending.map((r) => (
            <Card key={r.leave.id}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {r.meetingTitle} · {formatDate(r.startsAt)}
                  </div>
                  {r.leave.reason ? <div className="mt-1 text-sm">{r.leave.reason}</div> : null}
                </div>
                <LeaveDecision id={r.leave.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {decided.length ? (
        <>
          <h2 className="mt-8 mb-2 font-semibold">Recent decisions</h2>
          <div className="divide-y rounded-xl border text-sm">
            {decided.map((r) => (
              <div key={r.leave.id} className="flex items-center justify-between gap-3 px-4 py-2">
                <span>
                  {r.name} · {formatDate(r.startsAt)}
                </span>
                <Badge variant={r.leave.status === "approved" ? "secondary" : "destructive"}>{r.leave.status}</Badge>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </PageContainer>
  );
}
