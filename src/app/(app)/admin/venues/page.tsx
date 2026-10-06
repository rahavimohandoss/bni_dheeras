import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { db } from "@/db";
import { venue } from "@/db/schema";
import { requireCapPage } from "@/lib/session";
import { getAttendanceSettings } from "@/lib/settings";
import { VenueEditor } from "./venue-editor";

export const metadata: Metadata = { title: "Venues" };

export default async function VenuesPage() {
  await requireCapPage("meetings.manage");
  const [venues, settings] = await Promise.all([
    db.select().from(venue).orderBy(asc(venue.name)),
    getAttendanceSettings(),
  ]);
  return (
    <PageContainer>
      <PageHeader title="Venues" back={{ href: "/admin", label: "Admin" }} />
      <VenueEditor
        venues={venues.map((v) => ({ ...v, createdAt: v.createdAt.toISOString() }))}
        defaultGeofence={settings.defaultGeofenceM}
      />
    </PageContainer>
  );
}
