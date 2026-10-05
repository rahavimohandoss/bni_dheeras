import type { Metadata } from "next";
import Link from "next/link";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { membersNearby, myLocation } from "@/lib/nearby";
import { requireMember } from "@/lib/session";
import { NearMe } from "./near-me";

export const metadata: Metadata = { title: "Near me" };

export default async function NearPage() {
  const me = await requireMember();
  const mine = await myLocation(me.id);
  const fromBusiness = mine ? await membersNearby(me.id, { lat: mine.lat, lng: mine.lng }) : null;

  return (
    <PageContainer wide>
      <PageHeader
        title="Members near me"
        description="Chapter businesses from nearest to farthest. Distances are straight-line."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/me/location">{mine ? "Edit my location" : "Set my location"}</Link>
          </Button>
        }
      />
      <NearMe
        business={mine ? { lat: mine.lat, lng: mine.lng, label: mine.area ?? mine.city ?? "My business" } : null}
        initial={fromBusiness}
      />
    </PageContainer>
  );
}
