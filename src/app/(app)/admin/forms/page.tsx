import { count, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { form, formResponse } from "@/db/schema";
import { requireCapPage } from "@/lib/session";
import { NewFormButtons } from "./new-form-buttons";

export const metadata: Metadata = { title: "Forms" };

export default async function FormsAdminPage() {
  await requireCapPage("forms.manage");
  const rows = await db
    .select({ form, responses: count(formResponse.id) })
    .from(form)
    .leftJoin(formResponse, eq(formResponse.formId, form.id))
    .groupBy(form.id)
    .orderBy(desc(form.createdAt));
  return (
    <PageContainer>
      <PageHeader title="Forms" back={{ href: "/admin", label: "Admin" }} description="Start from a template or a blank form." />
      <NewFormButtons />
      <div className="mt-6 space-y-2">
        {rows.length === 0 ? <EmptyState title="No forms yet." /> : null}
        {rows.map(({ form: f, responses }) => (
          <Card key={f.id}>
            <CardContent className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <Link href={`/admin/forms/${f.id}`} className="font-medium hover:underline">
                  {f.title}
                </Link>
                <div className="text-sm text-muted-foreground">
                  {f.visibility === "public" ? "Public link" : "Members only"} · {responses} response{responses === 1 ? "" : "s"}
                </div>
              </div>
              {f.isActive ? <Badge variant="secondary">Open</Badge> : <Badge variant="outline">Closed</Badge>}
              <Link className="text-sm text-primary underline" href={`/admin/forms/${f.id}/responses`}>
                Responses
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
