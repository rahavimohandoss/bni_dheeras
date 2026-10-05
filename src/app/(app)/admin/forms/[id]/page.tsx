import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { form } from "@/db/schema";
import { requireCapPage } from "@/lib/session";
import { toIstDateInput } from "@/lib/time";
import { FormBuilder } from "./form-builder";
import { ShareForm } from "./share-form";

export const metadata: Metadata = { title: "Edit form" };

export default async function EditFormPage({ params }: PageProps<"/admin/forms/[id]">) {
  await requireCapPage("forms.manage");
  const { id } = await params;
  const [f] = await db.select().from(form).where(eq(form.id, id));
  if (!f) notFound();
  return (
    <PageContainer>
      <PageHeader
        title={f.title}
        back={{ href: "/admin/forms", label: "Forms" }}
        actions={
          <Button asChild variant="outline">
            <Link href={`/admin/forms/${f.id}/responses`}>Responses</Link>
          </Button>
        }
      />
      <ShareForm slug={f.slug} />
      <FormBuilder
        id={f.id}
        initial={{
          title: f.title,
          description: f.description ?? "",
          kind: f.kind,
          visibility: f.visibility,
          opensOn: f.opensAt ? toIstDateInput(f.opensAt) : "",
          closesOn: f.closesAt ? toIstDateInput(f.closesAt) : "",
          maxResponses: f.maxResponses === null ? "" : String(f.maxResponses),
          onePerMember: f.onePerMember,
          isActive: f.isActive,
          fields: f.fields,
        }}
      />
    </PageContainer>
  );
}
