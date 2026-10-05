import { desc, isNull } from "drizzle-orm";
import { MonitorIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { kiosk } from "@/db/schema";
import { getActiveMeetings } from "@/lib/attendance/queries";
import { requireCapPage } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { PairScreen, RevokeScreen } from "./pair-screen";

export const metadata: Metadata = { title: "LVH desk" };

export default async function LvhDeskPage() {
  await requireCapPage("kiosk.run");
  const [meetings, screens] = await Promise.all([
    getActiveMeetings(),
    db.select().from(kiosk).where(isNull(kiosk.revokedAt)).orderBy(desc(kiosk.createdAt)),
  ]);

  return (
    <PageContainer>
      <PageHeader title="LVH desk" description="Run the venue screen and the live check-in board." />

      <h2 className="mb-2 font-semibold">Today&apos;s meetings</h2>
      {meetings.length === 0 ? (
        <EmptyState title="No meeting today.">Meetings appear here on the day.</EmptyState>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <Card key={m.id}>
              <CardContent className="space-y-3 py-4">
                <div>
                  <div className="font-semibold">{m.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatDateTime(m.startsAt)}
                    {m.venue ? ` · ${m.venue.name}` : ""}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={`/lvh/${m.id}`}>
                      <UsersIcon /> Live board
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <a href={`/kiosk/${m.id}`} target="_blank" rel="noopener">
                      <MonitorIcon /> Show QR on this screen
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mt-8 mb-2 font-semibold">Venue screens</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Pair the projector laptop, TV or tablet once. A paired screen can only show the QR, so nobody&apos;s personal
        login stays open on it.
      </p>
      <PairScreen />
      {screens.length ? (
        <div className="mt-4 divide-y rounded-xl border">
          {screens.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span>
                {s.label}
                <span className="text-muted-foreground">
                  {s.lastSeenAt ? ` · seen ${formatDateTime(s.lastSeenAt)}` : " · not used yet"}
                </span>
              </span>
              <RevokeScreen id={s.id} />
            </div>
          ))}
        </div>
      ) : null}
    </PageContainer>
  );
}
