/**
 * Roles are assigned per term (they rotate every six months). Capabilities are
 * what the code checks. Admin is a technical super-user with every capability.
 */
export const ROLES = {
  president: "President",
  vice_president: "Vice President",
  secretary_treasurer: "Secretary / Treasurer",
  lvh_captain: "LVH Captain",
  lvh: "LVH Team",
  attendance_coordinator: "Attendance Coordinator",
  membership_committee: "Membership Committee (GARAM)",
  education_coordinator: "Education Slot Coordinator",
  feature_presentation_coordinator: "Feature Presentation Coordinator",
  events_coordinator: "Events & BBB Coordinator",
  training_coordinator: "Training Coordinator",
} as const;

export type Role = keyof typeof ROLES;
export const ROLE_KEYS = Object.keys(ROLES) as Role[];

export const CAPABILITIES = [
  "kiosk.run",
  "attendance.manual",
  "devices.approve",
  "leave.approve",
  "meeting.finalize",
  "palms.view",
  "meetings.manage",
  "awards.manage",
  "calendar.manage",
  "calendar.manage.feature_presentation",
  "calendar.manage.education_slot",
  "calendar.manage.event",
  "calendar.manage.training",
  "forms.manage",
  "members.manage",
  "roles.manage",
  "settings.manage",
  "audit.view",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const HEAD_TABLE: Capability[] = [
  "kiosk.run",
  "palms.view",
  "meetings.manage",
  "awards.manage",
  "calendar.manage",
  "forms.manage",
];

const ROLE_CAPS: Record<Role, Capability[]> = {
  president: [...HEAD_TABLE, "audit.view"],
  vice_president: [...HEAD_TABLE],
  secretary_treasurer: [
    ...HEAD_TABLE,
    "devices.approve",
    "leave.approve",
    "meeting.finalize",
    "members.manage",
    "audit.view",
  ],
  lvh_captain: ["kiosk.run", "attendance.manual", "meeting.finalize", "palms.view"],
  lvh: ["kiosk.run", "attendance.manual"],
  attendance_coordinator: [
    "kiosk.run",
    "devices.approve",
    "leave.approve",
    "meeting.finalize",
    "palms.view",
  ],
  membership_committee: ["palms.view"],
  education_coordinator: ["calendar.manage.education_slot"],
  feature_presentation_coordinator: ["calendar.manage.feature_presentation"],
  events_coordinator: ["calendar.manage.event"],
  training_coordinator: ["calendar.manage.training"],
};

export function capabilitiesFor(roles: readonly Role[], isAdmin: boolean): Set<Capability> {
  if (isAdmin) return new Set(CAPABILITIES);
  const caps = new Set<Capability>();
  for (const role of roles) for (const cap of ROLE_CAPS[role] ?? []) caps.add(cap);
  return caps;
}

/**
 * Separation of duties: the people who approve devices must not be able to
 * mark attendance manually, otherwise one person could approve a proxy phone
 * and also cover for it at the door.
 */
export function roleConflict(roles: readonly Role[]): string | null {
  const caps = capabilitiesFor(roles, false);
  if (caps.has("devices.approve") && caps.has("attendance.manual")) {
    return "One person can't both approve devices and do manual check-ins. Choose LVH roles or device-approver roles (Attendance Coordinator, Secretary / Treasurer), not both.";
  }
  return null;
}

export function isRole(value: string): value is Role {
  return value in ROLES;
}
