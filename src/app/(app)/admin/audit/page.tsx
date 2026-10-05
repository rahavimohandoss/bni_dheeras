import { desc, eq, like } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { auditLog, member } from "@/db/schema";
import { requireCapPage } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Audit log" };

const FILTERS = [
  { key: "", label: "All" },
  { key: "attendance", label: "Attendance" },
  { key: "device", label: "Devices" },
  { key: "meeting", label: "Meetings" },
  { key: "member", label: "Members" },
  { key: "role", label: "Roles" },
];

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireCapPage("audit.view");
  const { f } = await searchParams;
  const filter = typeof f === "string" && FILTERS.some((x) => x.key === f) ? f : "";
  const rows = await db
    .select({ log: auditLog, actor: member.fullName })
    .from(auditLog)
    .leftJoin(member, eq(member.id, auditLog.actorId))
    .where(filter ? like(auditLog.action, `${filter}.%`) : undefined)
    .orderBy(desc(auditLog.at))
    .limit(200);

  return (
    <PageContainer wide>
      <PageHeader
        title="Audit log"
        back={{ href: "/admin", label: "Admin" }}
        description="Every manual attendance change, approval and setting change, with who did it and why."
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={x.key ? `/admin/audit?f=${x.key}` : "/admin/audit"}
            className={`rounded-full border px-3 py-1 text-sm ${filter === x.key ? "border-primary bg-primary/10 text-primary" : ""}`}
          >
            {x.label}
          </Link>
        ))}
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ log, actor }) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm whitespace-nowrap">{formatDateTime(log.at)}</TableCell>
                <TableCell className="text-sm">{actor ?? "System"}</TableCell>
                <TableCell className="font-mono text-xs">{log.action}</TableCell>
                <TableCell className="max-w-md text-xs whitespace-normal text-muted-foreground">
                  {log.reason ? <div className="text-foreground">Reason: {log.reason}</div> : null}
                  {log.after ? <div className="line-clamp-2 break-all">{JSON.stringify(log.after)}</div> : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </PageContainer>
  );
}
