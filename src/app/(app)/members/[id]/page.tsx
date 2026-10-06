import { and, count, eq } from "drizzle-orm";
import {
  GlobeIcon,
  IdCardIcon,
  LinkIcon,
  MailIcon,
  MapPinIcon,
  MessageCircleIcon,
  NavigationIcon,
  PhoneIcon,
  PlayCircleIcon,
  TrophyIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MemberAvatar } from "@/components/member-avatar";
import { PageContainer } from "@/components/page-header";
import { PasswordButton } from "@/components/password-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { award, danceCard, member, memberLocation, memberProfile } from "@/db/schema";
import { whatsappLink } from "@/lib/members";
import { requireMember } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import { youtubeEmbedUrl } from "@/lib/video";

export async function generateMetadata({ params }: PageProps<"/members/[id]">): Promise<Metadata> {
  const { id } = await params;
  const [m] = await db.select({ name: member.fullName }).from(member).where(eq(member.id, id));
  return { title: m?.name ?? "Member" };
}

export default async function MemberPage({ params }: PageProps<"/members/[id]">) {
  const me = await requireMember();
  const { id } = await params;
  const [m] = await db.select().from(member).where(and(eq(member.id, id), eq(member.status, "active"), eq(member.isChapterMember, true)));
  if (!m) notFound();
  const [[profile], [loc], [card], [{ wins }]] = await Promise.all([
    db.select().from(memberProfile).where(eq(memberProfile.memberId, id)),
    db.select().from(memberLocation).where(and(eq(memberLocation.memberId, id), eq(memberLocation.visible, true))),
    db.select({ updatedAt: danceCard.updatedAt }).from(danceCard).where(eq(danceCard.memberId, id)),
    db.select({ wins: count() }).from(award).where(and(eq(award.memberId, id), eq(award.published, true))),
  ]);
  const embed = youtubeEmbedUrl(profile?.videoUrl);
  const wa = whatsappLink(profile?.whatsapp ?? m.phone);
  const socials = profile?.socials ?? {};

  return (
    <PageContainer>
      <div className="mb-5 flex items-center gap-4">
        <MemberAvatar name={m.fullName} src={publicUrl(m.photoKey)} className="size-20" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">{m.fullName}</h1>
          <div className="font-medium">{m.businessName}</div>
          <div className="text-sm text-muted-foreground">{m.category}</div>
        </div>
        {profile?.logoKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={publicUrl(profile.logoKey)!} alt={`${m.businessName ?? m.fullName} logo`} className="hidden size-20 rounded-xl border object-contain sm:block" />
        ) : null}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {m.phone ? (
          <Button asChild>
            <a href={`tel:${m.phone}`}>
              <PhoneIcon /> Call
            </a>
          </Button>
        ) : null}
        {wa ? (
          <Button asChild variant="outline">
            <a href={wa} target="_blank" rel="noopener">
              <MessageCircleIcon /> WhatsApp
            </a>
          </Button>
        ) : null}
        <Button asChild variant="outline">
          <a href={`mailto:${m.email}`}>
            <MailIcon /> Email
          </a>
        </Button>
        {card || id === me.id ? (
          <Button asChild variant="outline">
            <Link href={id === me.id ? "/dance-card" : `/dance-card/${id}`}>
              <IdCardIcon /> Dance card
            </Link>
          </Button>
        ) : null}
        {id !== me.id && me.caps.has("members.reset_password") ? (
          <PasswordButton memberId={id} name={m.fullName} variant="outline" />
        ) : null}
      </div>

      <div className="space-y-4">
        {profile?.about ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About the business</CardTitle>
            </CardHeader>
            <CardContent className="text-sm whitespace-pre-line">{profile.about}</CardContent>
          </Card>
        ) : null}

        {embed ? (
          <div className="aspect-video overflow-hidden rounded-xl border">
            <iframe
              src={embed}
              title={`${m.fullName} business presentation`}
              className="size-full"
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : profile?.videoUrl ? (
          <a className="text-sm text-primary underline" href={profile.videoUrl} target="_blank" rel="noopener">
            Watch the business presentation
          </a>
        ) : null}

        <Card>
          <CardContent className="space-y-2 py-4 text-sm">
            {profile?.website ? (
              <LinkRow icon={GlobeIcon} href={profile.website} label={profile.website.replace(/^https?:\/\//, "")} />
            ) : null}
            {socials.instagram ? <LinkRow icon={LinkIcon} href={socials.instagram} label="Instagram" /> : null}
            {socials.facebook ? <LinkRow icon={LinkIcon} href={socials.facebook} label="Facebook" /> : null}
            {socials.linkedin ? <LinkRow icon={LinkIcon} href={socials.linkedin} label="LinkedIn" /> : null}
            {socials.youtube ? <LinkRow icon={PlayCircleIcon} href={socials.youtube} label="YouTube" /> : null}
            {socials.x ? <LinkRow icon={LinkIcon} href={socials.x} label="X" /> : null}
            {loc ? (
              <div className="flex items-center gap-2">
                <MapPinIcon className="size-4 text-muted-foreground" />
                <span className="flex-1">
                  {loc.precision === "exact" && loc.address ? loc.address : [loc.area, loc.city].filter(Boolean).join(", ")}
                  {loc.precision === "area" ? " (area)" : ""}
                </span>
                {loc.precision === "exact" ? (
                  <a
                    className="inline-flex items-center gap-1 text-primary"
                    href={`https://www.google.com/maps/dir/?api=1&destination=${loc.displayLat},${loc.displayLng}`}
                    target="_blank"
                    rel="noopener"
                  >
                    <NavigationIcon className="size-4" /> Directions
                  </a>
                ) : null}
              </div>
            ) : null}
            {wins > 0 ? (
              <div className="flex items-center gap-2">
                <TrophyIcon className="size-4 text-primary" /> {wins} weekly recognition{wins > 1 ? "s" : ""}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

function LinkRow({ icon: Icon, href, label }: { icon: React.ElementType; href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener" className="flex items-center gap-2 text-primary hover:underline">
      <Icon className="size-4 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </a>
  );
}
