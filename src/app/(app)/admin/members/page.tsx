import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { member } from "@/db/schema";
import { requireCapPage } from "@/lib/session";
import { MembersAdmin } from "./members-admin";

export const metadata: Metadata = { title: "Members" };

export default async function MembersAdminPage() {
  const me = await requireCapPage("members.manage");
  const rows = await db
    .select({
      id: member.id,
      fullName: member.fullName,
      email: member.email,
      phone: member.phone,
      businessName: member.businessName,
      category: member.category,
      status: member.status,
      joinedOn: member.joinedOn,
      isAdmin: member.isAdmin,
      mustChangePassword: member.mustChangePassword,
    })
    .from(member)
    .orderBy(asc(member.fullName));
  return (
    <PageContainer wide>
      <PageHeader
        title="Members"
        back={{ href: "/admin", label: "Admin" }}
        description={`${rows.filter((r) => r.status === "active").length} active members. Only people on this list can sign in.`}
      />
      <MembersAdmin members={rows} meId={me.id} />
    </PageContainer>
  );
}
