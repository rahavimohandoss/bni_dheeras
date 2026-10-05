import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { requireCapPage } from "@/lib/session";
import { getDanceCardTemplate } from "@/lib/settings";
import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = { title: "Dance card template" };

export default async function DanceCardTemplatePage() {
  await requireCapPage("settings.manage");
  const template = await getDanceCardTemplate();
  return (
    <PageContainer>
      <PageHeader
        title="Dance card template"
        back={{ href: "/admin/settings", label: "Settings" }}
        description="Every member's dance card uses these questions. Name, business, category and contact come from their profile automatically. Removing a question hides its answers but doesn't delete them."
      />
      <TemplateEditor initial={template} />
    </PageContainer>
  );
}
