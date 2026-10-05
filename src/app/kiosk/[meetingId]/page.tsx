import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getMeetingWithVenue } from "@/lib/attendance/queries";
import { kioskAccess } from "@/lib/kiosk";
import { KioskDisplay } from "./kiosk-display";

export const metadata: Metadata = { title: "Check-in QR" };

export default async function KioskMeetingPage({ params }: PageProps<"/kiosk/[meetingId]">) {
  if (!(await kioskAccess())) redirect("/kiosk");
  const { meetingId } = await params;
  const m = await getMeetingWithVenue(meetingId);
  if (!m) notFound();
  return <KioskDisplay meetingId={m.id} />;
}
