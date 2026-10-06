import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { danceCard, member, memberLocation } from "@/db/schema";
import { DANCE_CARD_FIELDS } from "@/lib/dance-card";
import { publicUrl } from "@/lib/storage";

/** Everything needed to show or print one member's dance card. */
export async function loadDanceCard(memberId: string) {
  const [[m], [loc], [card]] = await Promise.all([
    db.select().from(member).where(eq(member.id, memberId)),
    db.select().from(memberLocation).where(eq(memberLocation.memberId, memberId)),
    db.select().from(danceCard).where(eq(danceCard.memberId, memberId)),
  ]);
  if (!m || m.status !== "active") return null;

  // The card's first questions start from the member's profile until they're answered on the card.
  const fromProfile: Record<string, string> = {
    name: m.fullName,
    company: m.businessName ?? "",
    profession: m.category ?? "",
    location: loc ? (loc.precision === "exact" && loc.address ? loc.address : [loc.area, loc.city].filter(Boolean).join(", ")) : "",
  };
  const saved = card?.data ?? {};
  const answers: Record<string, string> = {};
  for (const f of DANCE_CARD_FIELDS) {
    const value = saved[f.key] || fromProfile[f.key];
    if (value) answers[f.key] = value;
  }

  return {
    member: {
      id: m.id,
      name: m.fullName,
      business: m.businessName,
      category: m.category,
      phone: m.phone,
      email: m.email,
      photoUrl: publicUrl(m.photoKey),
    },
    answers,
    updatedAt: card?.updatedAt ?? null,
  };
}
