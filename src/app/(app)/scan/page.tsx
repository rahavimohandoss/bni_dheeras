import type { Metadata } from "next";
import { PageContainer, PageHeader } from "@/components/page-header";
import { getCurrentOrNextMeeting } from "@/lib/attendance/queries";
import { getMemberDevices } from "@/lib/devices";
import { requireMember } from "@/lib/session";
import { formatDateTime } from "@/lib/time";
import { ScanClient } from "./scan-client";

export const metadata: Metadata = { title: "Check in" };

export default async function ScanPage() {
  const me = await requireMember();
  const [devices, meeting] = await Promise.all([getMemberDevices(me.id), getCurrentOrNextMeeting()]);
  const isDev = process.env.NODE_ENV === "development";

  return (
    <PageContainer>
      <PageHeader
        title="Check in"
        description={
          meeting
            ? `${meeting.title} · ${formatDateTime(meeting.startsAt)}${meeting.venue ? ` · ${meeting.venue.name}` : ""}`
            : "No meeting is scheduled."
        }
      />
      <ScanClient
        memberId={me.id}
        devices={devices}
        devVenue={isDev && meeting?.venue ? { lat: meeting.venue.lat, lng: meeting.venue.lng } : null}
        isDev={isDev}
      />
    </PageContainer>
  );
}
