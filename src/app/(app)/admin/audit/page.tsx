import { count, desc, eq, like, or } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { auditLog, member } from "@/db/schema";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireCapPage } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 50;
/** Filter chips: each matches actions starting with any of its prefixes (e.g. "meeting."). */
const FILTERS: { key: string; label: string; prefixes: string[] }[] = [
  { key: "", label: "All", prefixes: [] },
  { key: "attendance", label: "Attendance", prefixes: ["attendance", "substitute", "absence", "kiosk"] },
  { key: "device", label: "Devices", prefixes: ["device"] },
  { key: "meeting", label: "Meetings", prefixes: ["meeting", "venue"] },
  { key: "member", label: "Members", prefixes: ["member"] },
  { key: "role", label: "Roles & terms", prefixes: ["role", "term", "admin"] },
  { key: "leave", label: "Leave", prefixes: ["leave"] },
  { key: "awards", label: "Recognitions", prefixes: ["awards"] },
  { key: "calendar", label: "Calendar", prefixes: ["calendar"] },
  { key: "feedback", label: "Feedback", prefixes: ["feedback"] },
  { key: "settings", label: "Settings", prefixes: ["settings", "setup"] },
];

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireCapPage("audit.view");
  const sp = await searchParams;
  const filter = FILTERS.find((x) => x.key === sp.f) ?? FILTERS[0];
  const where = filter.prefixes.length ? or(...filter.prefixes.map((p) => like(auditLog.action, `${p}.%`))) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(auditLog).where(where);
  const { page, pageCount, offset } = paginate(pageFromParam(sp.page), total, PAGE_SIZE);
  const rows = await db
    .select({ log: auditLog, actor: member.fullName })
    .from(auditLog)
    .leftJoin(member, eq(member.id, auditLog.actorId))
    .where(where)
    .orderBy(desc(auditLog.at))
    .limit(PAGE_SIZE)
    .offset(offset);

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
            href={pageHref("/admin/audit", { f: x.key || undefined }, 1)}
            className={`rounded-full border px-3 py-1 text-sm ${filter.key === x.key ? "border-primary bg-primary/10 text-primary" : ""}`}
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-sm text-muted-foreground">
                  Nothing recorded yet.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map(({ log, actor }) => (
              <TableRow key={log.id}>
                <TableCell className="align-top text-sm whitespace-nowrap">{formatDateTime(log.at)}</TableCell>
                <TableCell className="align-top text-sm">{actor ?? "System"}</TableCell>
                <TableCell className="align-top font-mono text-xs">{log.action}</TableCell>
                <TableCell className="max-w-md align-top text-xs whitespace-normal text-muted-foreground">
                  {log.reason ? <div className="text-foreground">Reason: {log.reason}</div> : null}
                  {log.before || log.after ? (
                    <details>
                      <summary className="cursor-pointer truncate">{summarize(log.after ?? log.before)}</summary>
                      {log.before ? (
                        <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 whitespace-pre-wrap break-all">
                          Before: {JSON.stringify(log.before, null, 2)}
                        </pre>
                      ) : null}
                      {log.after ? (
                        <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 whitespace-pre-wrap break-all">
                          After: {JSON.stringify(log.after, null, 2)}
                        </pre>
                      ) : null}
                    </details>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} href={(p) => pageHref("/admin/audit", { f: filter.key || undefined }, p)} />
    </PageContainer>
  );
}

/** One line for the collapsed row, e.g. `member: Priya Raman`. */
function summarize(value: unknown): string {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && typeof v !== "object")
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join(" · ") || "Details";
  }
  return "Details";
}
