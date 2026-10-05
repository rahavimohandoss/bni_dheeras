import { eq } from "drizzle-orm";
import { ChevronRightIcon, IdCardIcon, MapPinIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DeviceCard } from "@/components/device-card";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { memberLocation, memberProfile } from "@/db/schema";
import { getMemberDevices } from "@/lib/devices";
import { ROLES } from "@/lib/permissions";
import { requireMember } from "@/lib/session";
import { publicUrl } from "@/lib/storage";
import { ChangePasswordForm } from "./change-password-form";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "My profile" };

export default async function MePage() {
  const me = await requireMember();
  const [[profile], [location], devices] = await Promise.all([
    db.select().from(memberProfile).where(eq(memberProfile.memberId, me.id)),
    db.select().from(memberLocation).where(eq(memberLocation.memberId, me.id)),
    getMemberDevices(me.id),
  ]);

  return (
    <PageContainer>
      <PageHeader title="My profile" description={`${me.fullName} · ${me.email}`} />
      {me.roles.length ? (
        <div className="-mt-3 mb-4 flex flex-wrap gap-1.5">
          {me.roles.map((r) => (
            <Badge key={r} variant="secondary">
              {ROLES[r]}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/me/location">
            <Card className="h-full hover:border-primary/40">
              <CardContent className="flex items-center gap-3 py-4">
                <MapPinIcon className="size-5 text-primary" />
                <div className="flex-1 text-sm">
                  <div className="font-semibold">Business location</div>
                  <div className="text-muted-foreground">
                    {location
                      ? `${location.area ?? location.city ?? "Set"} · ${location.visible ? "shown to members" : "hidden"}`
                      : "Not set"}
                  </div>
                </div>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
          <Link href="/dance-card">
            <Card className="h-full hover:border-primary/40">
              <CardContent className="flex items-center gap-3 py-4">
                <IdCardIcon className="size-5 text-primary" />
                <div className="flex-1 text-sm">
                  <div className="font-semibold">1-to-1 dance card</div>
                  <div className="text-muted-foreground">Fill it in and download as PDF</div>
                </div>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Business profile</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm
              photoUrl={publicUrl(me.photoKey)}
              logoUrl={publicUrl(profile?.logoKey)}
              category={me.category}
              initial={{
                businessName: me.businessName ?? "",
                about: profile?.about ?? "",
                website: profile?.website ?? "",
                whatsapp: profile?.whatsapp ?? me.phone ?? "",
                videoUrl: profile?.videoUrl ?? "",
                instagram: profile?.socials.instagram ?? "",
                facebook: profile?.socials.facebook ?? "",
                linkedin: profile?.socials.linkedin ?? "",
                youtube: profile?.socials.youtube ?? "",
                x: profile?.socials.x ?? "",
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Check-in phone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DeviceCard memberId={me.id} devices={devices} />
            <p className="text-xs text-muted-foreground">
              Changing phones? Register the new one; after approval the old one stops working. Clearing this
              browser&apos;s data also removes its registration.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Password</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your login ID is {me.phone ? `your mobile number (${me.phone})` : `your email (${me.email})`}. Forgot your
              password later? Ask the President, VP or Secretary to reset it.
            </p>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
