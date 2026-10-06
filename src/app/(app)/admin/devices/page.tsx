import { asc, count, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { MemberAvatar } from "@/components/member-avatar";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { device, member } from "@/db/schema";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireCapPage } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import { formatDateTime } from "@/lib/time";
import { ApproveDeviceButton, RevokeDeviceButton } from "./device-buttons";

export const metadata: Metadata = { title: "Device approvals" };

const WAITING_PER_PAGE = 10;
const APPROVED_PER_PAGE = 20;

export default async function DevicesPage({ searchParams }: PageProps<"/admin/devices">) {
  await requireCapPage("devices.approve");
  const sp = await searchParams;
  const isPending = eq(device.status, "pending");
  const isApproved = eq(device.status, "approved");
  const [[{ waitingTotal }], [{ approvedTotal }]] = await Promise.all([
    db.select({ waitingTotal: count() }).from(device).where(isPending),
    db.select({ approvedTotal: count() }).from(device).where(isApproved),
  ]);
  const wp = paginate(pageFromParam(sp.wp), waitingTotal, WAITING_PER_PAGE);
  const ap = paginate(pageFromParam(sp.ap), approvedTotal, APPROVED_PER_PAGE);
  const columns = { device, memberName: member.fullName, photoKey: member.photoKey, business: member.businessName };
  const [pending, approved] = await Promise.all([
    // Newest first: at the device-setup meeting, the phone in front of you is at the top.
    db
      .select(columns)
      .from(device)
      .innerJoin(member, eq(member.id, device.memberId))
      .where(isPending)
      .orderBy(desc(device.createdAt))
      .limit(WAITING_PER_PAGE)
      .offset(wp.offset),
    db
      .select(columns)
      .from(device)
      .innerJoin(member, eq(member.id, device.memberId))
      .where(isApproved)
      .orderBy(asc(member.fullName))
      .limit(APPROVED_PER_PAGE)
      .offset(ap.offset),
  ]);
  // Each list keeps the other's page in its links.
  const keep = (p: number) => (p > 1 ? String(p) : undefined);
  const pages = { wp: keep(wp.page), ap: keep(ap.page) };

  return (
    <PageContainer>
      <PageHeader
        title="Device approvals"
        back={{ href: "/admin", label: "Admin" }}
        description="Approve a phone only when you can see the member holding it and the code on their screen matches."
      />
      <h2 className="mb-2 font-semibold">Waiting ({waitingTotal})</h2>
      {pending.length === 0 ? (
        <EmptyState title="No phones are waiting for approval." />
      ) : (
        <div className="space-y-2">
          {pending.map(({ device: d, memberName, photoKey, business }) => (
            <Card key={d.id}>
              <CardContent className="flex flex-wrap items-center gap-3 py-3">
                <MemberAvatar name={memberName} src={publicUrl(photoKey)} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{memberName}</div>
                  <div className="text-sm text-muted-foreground">
                    {business} · {d.label} · {formatDateTime(d.createdAt)}
                  </div>
                </div>
                <div className="rounded-md bg-muted px-3 py-1 font-mono text-xl font-bold tracking-widest">{d.approvalCode}</div>
                <ApproveDeviceButton id={d.id} name={memberName} code={d.approvalCode} />
                <RevokeDeviceButton id={d.id} name={memberName} pending />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Pagination
        page={wp.page}
        pageCount={wp.pageCount}
        total={waitingTotal}
        pageSize={WAITING_PER_PAGE}
        href={(p) => pageHref("/admin/devices", pages, p, "wp")}
      />

      <h2 className="mt-8 mb-2 font-semibold">Approved phones ({approvedTotal})</h2>
      <div className="divide-y rounded-xl border">
        {approved.map(({ device: d, memberName }) => (
          <div key={d.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{memberName}</div>
              <div className="text-muted-foreground">
                {d.label}
                {d.lastUsedAt ? ` · last check-in ${formatDateTime(d.lastUsedAt)}` : ""}
              </div>
            </div>
            <Badge variant="secondary">Approved</Badge>
            <RevokeDeviceButton id={d.id} name={memberName} />
          </div>
        ))}
        {approved.length === 0 ? <div className="px-4 py-3 text-sm text-muted-foreground">None yet.</div> : null}
      </div>
      <Pagination
        page={ap.page}
        pageCount={ap.pageCount}
        total={approvedTotal}
        pageSize={APPROVED_PER_PAGE}
        href={(p) => pageHref("/admin/devices", pages, p, "ap")}
      />
    </PageContainer>
  );
}
