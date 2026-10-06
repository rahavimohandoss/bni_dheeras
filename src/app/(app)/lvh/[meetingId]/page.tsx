import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMeetingWithVenue } from "@/lib/attendance/queries";
import { requireCapPage } from "@/lib/session";
import { LvhBoard } from "./lvh-board";

export const metadata: Metadata = { title: "Live board" };

export default async function LvhBoardPage({ params }: PageProps<"/lvh/[meetingId]">) {
  const me = await requireCapPage("kiosk.run");
  const { meetingId } = await params;
  const m = await getMeetingWithVenue(meetingId);
  if (!m) notFound();
  return (
    <LvhBoard meetingId={m.id} canManual={me.caps.has("attendance.manual")} canFinalize={me.caps.has("meeting.finalize")} />
  );
}
