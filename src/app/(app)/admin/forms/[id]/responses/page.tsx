import { desc, eq } from "drizzle-orm";
import { DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { db } from "@/db";
import { form, formResponse, member } from "@/db/schema";
import { answerText } from "@/lib/forms";
import { requireCapPage } from "@/lib/session";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Responses" };

export default async function ResponsesPage({ params }: PageProps<"/admin/forms/[id]/responses">) {
  await requireCapPage("forms.manage");
  const { id } = await params;
  const [f] = await db.select().from(form).where(eq(form.id, id));
  if (!f) notFound();
  const rows = await db
    .select({ response: formResponse, memberName: member.fullName })
    .from(formResponse)
    .leftJoin(member, eq(member.id, formResponse.memberId))
    .where(eq(formResponse.formId, f.id))
    .orderBy(desc(formResponse.createdAt))
    .limit(500);

  return (
    <PageContainer wide>
      <PageHeader
        title={`${f.title} · responses`}
        back={{ href: `/admin/forms/${f.id}`, label: "Form" }}
        description={`${rows.length} response${rows.length === 1 ? "" : "s"}`}
        actions={
          <Button asChild variant="outline">
            <a href={`/api/forms/${f.id}/responses`}>
              <DownloadIcon /> CSV
            </a>
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No responses yet." />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                {f.visibility === "members" ? <TableHead>Member</TableHead> : null}
                {f.fields.map((q) => (
                  <TableHead key={q.id}>{q.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ response: r, memberName }) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatDateTime(r.createdAt)}</TableCell>
                  {f.visibility === "members" ? <TableCell>{memberName ?? ""}</TableCell> : null}
                  {f.fields.map((q) => (
                    <TableCell key={q.id} className="max-w-64 whitespace-normal">
                      {answerText(r.data[q.id])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </PageContainer>
  );
}
