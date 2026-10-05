import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { myLocation } from "@/lib/nearby";
import { requireMember } from "@/lib/session";
import { LocationForm } from "./location-form";

export const metadata: Metadata = { title: "Business location" };

export default async function MyLocationPage() {
  const me = await requireMember();
  const loc = await myLocation(me.id);
  return (
    <PageContainer>
      <PageHeader
        title="Business location"
        back={{ href: "/me", label: "My profile" }}
        description="Business address only. Members use it to find chapter businesses near them. Only signed-in members can see it."
      />
      <LocationForm
        initial={
          loc
            ? {
                lat: loc.lat,
                lng: loc.lng,
                address: loc.address ?? undefined,
                area: loc.area,
                city: loc.city,
                precision: loc.precision,
                visible: loc.visible,
              }
            : null
        }
      />
    </PageContainer>
  );
}
