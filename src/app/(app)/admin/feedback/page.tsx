import { and, count, desc, eq, ne } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { FeedbackStatusBadge } from "@/components/feedback-status";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { db } from "@/db";
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, type FeedbackStatus, feedback, member } from "@/db/schema";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireCapPage } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { FeedbackReview } from "./feedback-review";

export const metadata: Metadata = { title: "Suggestions & feedback" };

const PAGE_SIZE = 15;
const STATUS_FILTERS = [
  { value: "open", label: "Open" },
  { value: "new", label: "New" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
  { value: "all", label: "All" },
] as const;

export default async function FeedbackAdminPage({ searchParams }: PageProps<"/admin/feedback">) {
  await requireCapPage("feedback.manage");
  const sp = await searchParams;
  const status = STATUS_FILTERS.some((f) => f.value === sp.status) ? (sp.status as string) : "open";
  const kind = (FEEDBACK_KINDS as readonly string[]).includes(String(sp.kind)) ? (sp.kind as (typeof FEEDBACK_KINDS)[number]) : undefined;

  // "Open" = anything not done yet.
  const statusCondition =
    status === "open"
      ? ne(feedback.status, "done")
      : (FEEDBACK_STATUSES as readonly string[]).includes(status)
        ? eq(feedback.status, status as FeedbackStatus)
        : undefined;
  const finalWhere = and(statusCondition, kind ? eq(feedback.kind, kind) : undefined);

  const [{ total }] = await db.select({ total: count() }).from(feedback).where(finalWhere);
  const { page, pageCount, offset } = paginate(pageFromParam(sp.page), total, PAGE_SIZE);
  const rows = await db
    .select({ f: feedback, name: member.fullName })
    .from(feedback)
    .innerJoin(member, eq(member.id, feedback.memberId))
    .where(finalWhere)
    .orderBy(desc(feedback.createdAt))
    .limit(PAGE_SIZE)
    .offset(offset);

  const link = (patch: Record<string, string | undefined>) =>
    pageHref("/admin/feedback", { status, kind, ...patch }, 1);

  return (
    <PageContainer>
      <PageHeader title="Suggestions & feedback" back={{ href: "/admin", label: "Admin" }} />
      <div className="mb-2 flex flex-wrap gap-1">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={link({ status: f.value })}
            className={cn(
              "rounded-md border px-2.5 py-1 text-sm",
              status === f.value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-1">
        {[undefined, ...FEEDBACK_KINDS].map((k) => (
          <Link
            key={k ?? "any"}
            href={link({ kind: k })}
            className={cn("rounded-md border px-2.5 py-1 text-xs", kind === k ? "border-foreground font-medium" : "text-muted-foreground hover:bg-muted")}
          >
            {k === undefined ? "Both kinds" : k === "suggestion" ? "Suggestions" : "Feedback"}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nothing here." />
      ) : (
        <div className="space-y-3">
          {rows.map(({ f, name }) => (
            <Card key={f.id}>
              <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="outline">{f.kind === "suggestion" ? "Suggestion" : "Feedback"}</Badge>
                  <span className="font-medium">{f.anonymous ? "Anonymous" : name}</span>
                  <span className="text-muted-foreground">{formatDateTime(f.createdAt)}</span>
                </div>
                <FeedbackStatusBadge status={f.status} />
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm whitespace-pre-line">{f.message}</p>
                <FeedbackReview id={f.id} status={f.status} response={f.response} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={page} pageCount={pageCount} total={total} pageSize={PAGE_SIZE} href={(p) => pageHref("/admin/feedback", { status, kind }, p)} />
    </PageContainer>
  );
}
