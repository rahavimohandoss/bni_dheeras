import { asc, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { member, roleAssignment, term } from "@/db/schema";
import { ROLES } from "@/lib/permissions";
import { requireCapPage } from "@/lib/session";
import { toIstDateInput } from "@/lib/time";
import { RolesAdmin } from "./roles-admin";

export const metadata: Metadata = { title: "Roles & terms" };

export default async function RolesPage({ searchParams }: PageProps<"/admin/roles">) {
  const me = await requireCapPage("roles.manage");
  const terms = await db.select().from(term).orderBy(desc(term.startsOn));
  const today = toIstDateInput(new Date());
  const { term: termParam } = await searchParams;
  const selected =
    terms.find((t) => t.id === termParam) ?? terms.find((t) => t.startsOn <= today && t.endsOn >= today) ?? terms[0];
  const members = await db
    .select({ id: member.id, fullName: member.fullName, isAdmin: member.isAdmin, status: member.status })
    .from(member)
    .orderBy(asc(member.fullName));
  const assignments = selected
    ? await db
        .select({ id: roleAssignment.id, role: roleAssignment.role, memberId: roleAssignment.memberId })
        .from(roleAssignment)
        .where(eq(roleAssignment.termId, selected.id))
    : [];

  return (
    <PageContainer wide>
      <PageHeader
        title="Roles & terms"
        back={{ href: "/admin", label: "Admin" }}
        description="Roles change every term. Permissions follow the role automatically."
      />
      <RolesAdmin
        meId={me.id}
        terms={terms.map((t) => ({ id: t.id, name: t.name, startsOn: t.startsOn, endsOn: t.endsOn }))}
        selectedTermId={selected?.id ?? null}
        members={members.filter((m) => m.status === "active")}
        assignments={assignments}
        roles={Object.entries(ROLES).map(([key, label]) => ({ key, label }))}
      />
    </PageContainer>
  );
}
