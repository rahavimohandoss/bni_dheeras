import "server-only";
import type { CalendarKind } from "@/db/schema";
import type { Capability } from "@/lib/permissions";
import type { CurrentMember } from "@/lib/session";

/** calendar.manage covers every kind; coordinators get only their own kind. */
export function canManageKind(me: CurrentMember, kind: CalendarKind): boolean {
  if (me.caps.has("calendar.manage")) return true;
  const specific: Partial<Record<CalendarKind, Capability>> = {
    feature_presentation: "calendar.manage.feature_presentation",
    education_slot: "calendar.manage.education_slot",
    event: "calendar.manage.event",
    training: "calendar.manage.training",
  };
  const cap = specific[kind];
  return !!cap && me.caps.has(cap);
}
