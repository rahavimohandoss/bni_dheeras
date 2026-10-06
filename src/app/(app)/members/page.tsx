import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { member } from "@/db/schema";
import { requireMember } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import { Directory } from "./directory";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  await requireMember();
  const rows = await db
    .select({
      id: member.id,
      name: member.fullName,
      business: member.businessName,
      category: member.category,
      photoKey: member.photoKey,
    })
    .from(member)
    .where(and(eq(member.status, "active"), eq(member.isChapterMember, true)))
    .orderBy(asc(member.fullName));
  return (
    <PageContainer wide>
      <PageHeader title="Members" description={`${rows.length} members in BNI Dheeras`} />
      <Directory members={rows.map(({ photoKey, ...r }) => ({ ...r, photoUrl: publicUrl(photoKey) }))} />
    </PageContainer>
  );
}
