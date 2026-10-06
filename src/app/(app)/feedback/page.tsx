import { count, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { FeedbackStatusBadge } from "@/components/feedback-status";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Pagination } from "@/components/pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { feedback } from "@/db/schema";
import { pageFromParam, pageHref, paginate } from "@/lib/pagination";
import { requireMember } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = { title: "Suggestions & feedback" };

const PAGE_SIZE = 10;

export default async function FeedbackPage({ searchParams }: PageProps<"/feedback">) {
  const me = await requireMember();
  const mine = eq(feedback.memberId, me.id);
  const [{ total }] = await db.select({ total: count() }).from(feedback).where(mine);
  const { page, pageCount, offset } = paginate(pageFromParam((await searchParams).page), total, PAGE_SIZE);
  const rows = await db.select().from(feedback).where(mine).orderBy(desc(feedback.createdAt)).limit(PAGE_SIZE).offset(offset);

  return (
    <PageContainer>
      <PageHeader title="Suggestions & feedback" description="Ideas and feedback go to the President, VP and Secretary." />
      <Card className="mb-6">
        <CardContent className="py-4">
          <FeedbackForm />
        </CardContent>
      </Card>

      <h2 className="mb-2 font-semibold">What you&apos;ve sent</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing yet.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((f) => (
            <Card key={f.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {f.kind === "suggestion" ? "Suggestion" : "Feedback"} · {formatDateTime(f.createdAt)}
                  {f.anonymous ? " · name hidden" : ""}
                </CardTitle>
                <FeedbackStatusBadge status={f.status} />
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm whitespace-pre-line">{f.message}</p>
                {f.response ? (
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Head Table reply</div>
                    <p className="whitespace-pre-line">{f.response}</p>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Pagination page={page} pageCount={pageCount} href={(p) => pageHref("/feedback", {}, p)} />
    </PageContainer>
  );
}
