import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getActiveMeetings } from "@/lib/attendance/queries";
import { kioskAccess } from "@/lib/kiosk";
import { formatDateTime } from "@/lib/time";
import { PairForm } from "./pair-form";

export const metadata: Metadata = { title: "Venue screen" };

export default async function KioskHome() {
  const access = await kioskAccess();
  if (!access) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
        <h1 className="text-2xl font-bold">Set up this venue screen</h1>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">
          On an LVH team phone, open <b>LVH desk → Pair a venue screen</b> and enter the 6-digit code here. This screen
          will then only show the check-in QR.
        </p>
        <PairForm />
      </main>
    );
  }
  const meetings = await getActiveMeetings();
  return (
    <main className="mx-auto min-h-dvh max-w-xl px-6 py-10">
      <h1 className="text-2xl font-bold">Choose the meeting to display</h1>
      <div className="mt-6 space-y-3">
        {meetings.length === 0 ? (
          <p className="text-muted-foreground">No meetings today. Meetings appear here from an hour before check-in opens.</p>
        ) : (
          meetings.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 rounded-xl border p-4">
              <div>
                <div className="font-semibold">{m.title}</div>
                <div className="text-sm text-muted-foreground">
                  {formatDateTime(m.startsAt)}
                  {m.venue ? ` · ${m.venue.name}` : ""}
                </div>
              </div>
              <Button asChild>
                <Link href={`/kiosk/${m.id}`}>Show QR</Link>
              </Button>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
