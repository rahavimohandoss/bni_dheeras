/**
 * Roles are assigned per term (they rotate every six months). Capabilities are
 * what the code checks. Admin is a technical super-user with every capability,
 * and the President of the current term has exactly the same access.
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
  "members.reset_password",
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
  "members.reset_password",
];

const ROLE_CAPS: Record<Role, readonly Capability[]> = {
  president: CAPABILITIES, // same as Admin (chapter decision D7)
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

/** Admin, or the President of the current term: every capability and the same exemptions. */
export function hasFullAccess(roles: readonly Role[], isAdmin: boolean): boolean {
  return isAdmin || roles.includes("president");
}

export function capabilitiesFor(roles: readonly Role[], isAdmin: boolean): Set<Capability> {
  if (hasFullAccess(roles, isAdmin)) return new Set(CAPABILITIES);
  const caps = new Set<Capability>();
  for (const role of roles) for (const cap of ROLE_CAPS[role] ?? []) caps.add(cap);
  return caps;
}

/**
 * Separation of duties: the people who approve devices must not be able to
 * mark attendance manually, otherwise one person could approve a proxy phone
 * and also cover for it at the door. Admin and the President hold every
 * capability by design, so the rule doesn't apply to them; their actions are
 * audit-logged instead.
 */
export function roleConflict(roles: readonly Role[]): string | null {
  if (hasFullAccess(roles, false)) return null;
  const caps = capabilitiesFor(roles, false);
  if (caps.has("devices.approve") && caps.has("attendance.manual")) {
    return "One person can't both approve devices and do manual check-ins. Choose LVH roles or device-approver roles (Attendance Coordinator, Secretary / Treasurer), not both.";
  }
  return null;
}

/**
 * True when `actor` holds every capability `target` holds. Resetting someone's
 * password to the shared default lets you sign in as them, so a Head Table
 * member may only reset people who can't do more than they can (a VP can't
 * reset the President or the Secretary, for example).
 */
export function capsCover(actor: ReadonlySet<Capability>, target: ReadonlySet<Capability>): boolean {
  for (const cap of target) {
    if (actor.has(cap)) continue;
    if (cap.startsWith("calendar.manage.") && actor.has("calendar.manage")) continue;
    return false;
  }
  return true;
}

export function isRole(value: string): value is Role {
  return value in ROLES;
}
