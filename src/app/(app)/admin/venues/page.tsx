import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { venue } from "@/db/schema";
import { requireCapPage } from "@/lib/session";
import { VenueEditor } from "./venue-editor";

export const metadata: Metadata = { title: "Venues" };

export default async function VenuesPage() {
  await requireCapPage("meetings.manage");
  const venues = await db
    .select({ id: venue.id, name: venue.name, address: venue.address, isActive: venue.isActive })
    .from(venue)
    .orderBy(asc(venue.name));
  return (
    <PageContainer>
      <PageHeader title="Venues" back={{ href: "/admin", label: "Admin" }} />
      <VenueEditor venues={venues} />
    </PageContainer>
  );
}
