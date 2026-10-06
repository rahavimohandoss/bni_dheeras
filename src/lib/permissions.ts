/**
 * Roles are assigned per term (they rotate every six months). Capabilities are
 * what the code checks. Admin is a technical super-user with every capability,
 * and the President of the current term has exactly the same access.
 */
export const ROLES = {
  president: "President",
  vice_president: "Vice President",
  secretary_treasurer: "Secretary / Treasurer",
  lvh: "LVH Team",
  attendance_coordinator: "Attendance Coordinator",
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
  "feedback.manage",
  "celebrations.view",
  "members.manage",
  "members.reset_password",
  "roles.manage",
  "settings.manage",
  "audit.view",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/** What each capability lets someone do, as shown on the Roles page. */
export const CAPABILITY_LABELS: Record<Capability, string> = {
  "kiosk.run": "Run the LVH desk and the venue screen's QR",
  "attendance.manual": "Mark members in or late by hand, and scan check-in passes",
  "devices.approve": "Approve members' phones for check-in",
  "leave.approve": "Approve medical leave",
  "meeting.finalize": "Finalize meetings, and reopen them to correct a status",
  "palms.view": "See Attendance & PALMS and the summaries",
  "meetings.manage": "Create, edit, cancel and delete meetings; venues",
  "awards.manage": "Choose and publish the weekly recognitions",
  "calendar.manage": "Manage the calendar: events, trainings and presentation slots",
  "feedback.manage": "Read and reply to suggestions and feedback",
  "celebrations.view": "See members' birthdays and anniversaries",
  "members.manage": "Add, edit, import and deactivate members",
  "members.reset_password": "Reset a forgotten password to the default",
  "roles.manage": "Assign roles, manage terms and app admins",
  "settings.manage": "Change settings: attendance rules and the default password",
  "audit.view": "See the audit log",
};

/** President (full access), VP and Secretary / Treasurer. */
const HEAD_TABLE: Capability[] = [
  "kiosk.run",
  "palms.view",
  "meetings.manage",
  "awards.manage",
  "calendar.manage",
  "feedback.manage",
  "celebrations.view",
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
  lvh: ["kiosk.run", "attendance.manual"],
  attendance_coordinator: [
    "kiosk.run",
    "devices.approve",
    "leave.approve",
    "meeting.finalize",
    "palms.view",
  ],
};

/** The capabilities one role gives, in the order of CAPABILITIES. */
export function roleCapabilities(role: Role): Capability[] {
  return CAPABILITIES.filter((c) => ROLE_CAPS[role].includes(c));
}

/** Admin, or the President of the current term: every capability and the same exemptions. */
export function hasFullAccess(roles: readonly Role[], isAdmin: boolean): boolean {
  return isAdmin || roles.includes("president");
}

export function capabilitiesFor(roles: readonly Role[], isAdmin: boolean): Set<Capability> {
  if (hasFullAccess(roles, isAdmin)) return new Set(CAPABILITIES);
  const caps = new Set<Capability>();
  // Roles removed from the app may still sit in old terms' data: they give nothing.
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
    return "One person can't both approve devices and do manual check-ins. Choose LVH Team or a device-approver role (Attendance Coordinator, Secretary / Treasurer), not both.";
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
  for (const cap of target) if (!actor.has(cap)) return false;
  return true;
}

export function isRole(value: string): value is Role {
  return value in ROLES;
}
