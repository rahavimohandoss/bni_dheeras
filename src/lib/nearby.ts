import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { member, memberLocation } from "@/db/schema";
import { haversineM, type LatLng } from "@/lib/geo";
import { whatsappLink } from "@/lib/members";
import { publicUrl } from "@/lib/storage";

export type NearbyMember = {
  id: string;
  name: string;
  business: string | null;
  category: string | null;
  area: string | null;
  city: string | null;
  lat: number;
  lng: number;
  precision: "exact" | "area";
  distanceM: number;
  photoUrl: string | null;
  phone: string | null;
  whatsapp: string | null;
};

/**
 * Every other member who chose to show their business, sorted nearest →
 * farthest from `origin`. Distances use the *displayed* point, so an
 * "area only" member's exact address can't be worked out from distances.
 */
export async function membersNearby(viewerId: string, origin: LatLng): Promise<NearbyMember[]> {
  const rows = await db
    .select({
      id: member.id,
      name: member.fullName,
      business: member.businessName,
      category: member.category,
      photoKey: member.photoKey,
      phone: member.phone,
      area: memberLocation.area,
      city: memberLocation.city,
      lat: memberLocation.displayLat,
      lng: memberLocation.displayLng,
      precision: memberLocation.precision,
    })
    .from(memberLocation)
    .innerJoin(member, eq(member.id, memberLocation.memberId))
    .where(and(eq(memberLocation.visible, true), eq(member.status, "active"), eq(member.isChapterMember, true), ne(member.id, viewerId)));

  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      business: r.business,
      category: r.category,
      area: r.area,
      city: r.city,
      lat: r.lat,
      lng: r.lng,
      precision: r.precision,
      distanceM: haversineM(origin, r),
      photoUrl: publicUrl(r.photoKey),
      phone: r.phone,
      whatsapp: whatsappLink(r.phone),
    }))
    .sort((a, b) => a.distanceM - b.distanceM);
}

export async function myLocation(memberId: string) {
  const [row] = await db.select().from(memberLocation).where(eq(memberLocation.memberId, memberId));
  return row ?? null;
}
