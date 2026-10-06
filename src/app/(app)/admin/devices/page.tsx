import { desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import { MemberAvatar } from "@/components/member-avatar";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { device, member } from "@/db/schema";
import { requireCapPage } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import { formatDateTime } from "@/lib/time";
import { ApproveDeviceButton, RevokeDeviceButton } from "./device-buttons";

export const metadata: Metadata = { title: "Device approvals" };

export default async function DevicesPage() {
  await requireCapPage("devices.approve");
  const rows = await db
    .select({ device, memberName: member.fullName, photoKey: member.photoKey, business: member.businessName })
    .from(device)
    .innerJoin(member, eq(member.id, device.memberId))
    .where(inArray(device.status, ["pending", "approved"]))
    .orderBy(desc(device.createdAt));
  const pending = rows.filter((r) => r.device.status === "pending");
  const approved = rows.filter((r) => r.device.status === "approved");

  return (
    <PageContainer>
      <PageHeader
        title="Device approvals"
        back={{ href: "/admin", label: "Admin" }}
        description="Approve a phone only when you can see the member holding it and the code on their screen matches."
      />
      <h2 className="mb-2 font-semibold">Waiting ({pending.length})</h2>
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

      <h2 className="mt-8 mb-2 font-semibold">Approved phones ({approved.length})</h2>
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
    </PageContainer>
  );
}
