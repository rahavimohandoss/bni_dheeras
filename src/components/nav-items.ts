import type { Capability } from "@/lib/permissions";

export type NavItem = { href: string; label: string; icon: string; cap?: Capability; anyCap?: Capability[] };

/** Bottom navigation on phones. */
export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/scan", label: "Check in", icon: "scan" },
  { href: "/near", label: "Near me", icon: "map" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
  { href: "/more", label: "More", icon: "menu" },
];

/** Everything else, shown on the More page and in the desktop header. */
export const SECONDARY_NAV: NavItem[] = [
  { href: "/members", label: "Members", icon: "users" },
  { href: "/awards", label: "Recognitions", icon: "trophy" },
  { href: "/dance-card", label: "My dance card", icon: "card" },
  { href: "/feedback", label: "Feedback", icon: "feedback" },
  { href: "/me", label: "My profile", icon: "user" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
];

export const STAFF_NAV: NavItem[] = [
  { href: "/lvh", label: "LVH desk", icon: "door", cap: "kiosk.run" },
  { href: "/admin", label: "Admin", icon: "settings", anyCap: [
    "members.manage",
    "roles.manage",
    "devices.approve",
    "leave.approve",
    "meetings.manage",
    "awards.manage",
    "calendar.manage",
    "feedback.manage",
    "settings.manage",
    "audit.view",
    "palms.view",
  ] },
];

export function visible(item: NavItem, caps: ReadonlySet<string>): boolean {
  if (item.cap && !caps.has(item.cap)) return false;
  if (item.anyCap && !item.anyCap.some((c) => caps.has(c))) return false;
  return true;
}
