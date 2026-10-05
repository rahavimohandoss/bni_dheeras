import { desc, eq } from "drizzle-orm";
import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { form } from "@/db/schema";
import { requireMember } from "@/lib/session";

export const metadata: Metadata = { title: "Forms" };

export default async function FormsPage() {
  const me = await requireMember();
  const now = new Date();
  const rows = (
    await db.select().from(form).where(eq(form.isActive, true)).orderBy(desc(form.createdAt))
  ).filter((f) => (!f.opensAt || f.opensAt <= now) && (!f.closesAt || f.closesAt >= now));

  return (
    <PageContainer>
      <PageHeader
        title="Forms"
        description="Surveys and registrations from the chapter. Visitor forms can be shared with guests."
        actions={
          me.caps.has("forms.manage") ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/forms">Manage forms</Link>
            </Button>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No open forms right now." />
      ) : (
        <div className="space-y-2">
          {rows.map((f) => (
            <Link key={f.id} href={`/f/${f.slug}`}>
              <Card className="mb-2 hover:border-primary/40">
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{f.title}</div>
                    <div className="text-sm text-muted-foreground">
                      {f.visibility === "public" ? "Shareable with visitors" : "Members only"}
                    </div>
                  </div>
                  <ChevronRightIcon className="size-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
