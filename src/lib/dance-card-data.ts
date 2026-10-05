import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { danceCard, member, memberProfile } from "@/db/schema";
import { getDanceCardTemplate } from "@/lib/settings";
import { publicUrl } from "@/lib/storage";

/** Everything needed to show or print one member's dance card. */
export async function loadDanceCard(memberId: string) {
  const [[m], [profile], [card], template] = await Promise.all([
    db.select().from(member).where(eq(member.id, memberId)),
    db.select().from(memberProfile).where(eq(memberProfile.memberId, memberId)),
    db.select().from(danceCard).where(eq(danceCard.memberId, memberId)),
    getDanceCardTemplate(),
  ]);
  if (!m || m.status !== "active") return null;
  return {
    member: {
      id: m.id,
      name: m.fullName,
      business: m.businessName,
      category: m.category,
      phone: m.phone,
      email: m.email,
      website: profile?.website ?? null,
      photoKey: m.photoKey,
      photoUrl: publicUrl(m.photoKey),
    },
    template,
    data: card?.data ?? {},
    updatedAt: card?.updatedAt ?? null,
  };
}
