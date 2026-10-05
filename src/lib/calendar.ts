import "server-only";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { type CalendarKind, calendarEvent, meeting, member, venue } from "@/db/schema";

export type CalendarItem = {
  id: string;
  source: "meeting" | "event";
  kind: CalendarKind | "meeting";
  title: string;
  startsAt: Date;
  endsAt: Date;
  location: string | null;
  description: string | null;
  link: string | null;
  presenter: { id: string; name: string } | null;
  cancelled: boolean;
};

export const KIND_LABELS: Record<CalendarItem["kind"], string> = {
  meeting: "Chapter meeting",
  event: "Event",
  training: "Training",
  feature_presentation: "Feature presentation",
  education_slot: "Education slot",
  other: "Other",
};

/** Meetings and calendar events between two instants, in start order. */
export async function calendarItems(from: Date, to: Date): Promise<CalendarItem[]> {
  const [meetings, events] = await Promise.all([
    db
      .select({ meeting, venueName: venue.name, venueAddress: venue.address })
      .from(meeting)
      .leftJoin(venue, eq(venue.id, meeting.venueId))
      .where(and(gte(meeting.startsAt, from), lt(meeting.startsAt, to)))
      .orderBy(asc(meeting.startsAt)),
    db
      .select({ event: calendarEvent, presenterName: member.fullName })
      .from(calendarEvent)
      .leftJoin(member, eq(member.id, calendarEvent.memberId))
      .where(and(gte(calendarEvent.startsAt, from), lt(calendarEvent.startsAt, to)))
      .orderBy(asc(calendarEvent.startsAt)),
  ]);

  const items: CalendarItem[] = [
    ...meetings.map(({ meeting: m, venueName, venueAddress }) => ({
      id: m.id,
      source: "meeting" as const,
      kind: "meeting" as const,
      title: m.title,
      startsAt: m.startsAt,
      endsAt: m.endsAt,
      location: m.mode === "online" ? "Online" : [venueName, venueAddress].filter(Boolean).join(", ") || null,
      description: m.notes,
      link: null,
      presenter: null,
      cancelled: m.status === "cancelled",
    })),
    ...events.map(({ event: e, presenterName }) => ({
      id: e.id,
      source: "event" as const,
      kind: e.kind,
      title: e.title,
      startsAt: e.startsAt,
      endsAt: e.endsAt,
      location: e.location,
      description: e.description,
      link: e.link,
      presenter: e.memberId && presenterName ? { id: e.memberId, name: presenterName } : null,
      cancelled: false,
    })),
  ];
  return items.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
}
