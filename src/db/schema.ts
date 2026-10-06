import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Better Auth tables (field names must match Better Auth's model)     */
/* ------------------------------------------------------------------ */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/** Password sign-in attempts, for throttling guesses per login ID and per IP. */
export const loginAttempt = pgTable(
  "login_attempt",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    ip: text("ip"),
    ok: boolean("ok").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("login_attempt_identifier_idx").on(t.identifier, t.createdAt),
    index("login_attempt_ip_idx").on(t.ip, t.createdAt),
  ],
);

/* ------------------------------------------------------------------ */
/* Members, terms and roles                                            */
/* ------------------------------------------------------------------ */

export const MEMBER_STATUSES = ["active", "inactive"] as const;

/** One row per chapter member. `id` is the Better Auth user id. */
export const member = pgTable("member", {
  id: text("id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").unique(),
  businessName: text("business_name"),
  category: text("category"),
  photoKey: text("photo_key"),
  status: text("status", { enum: MEMBER_STATUSES }).notNull().default("active"),
  isAdmin: boolean("is_admin").notNull().default(false),
  /** Still on the chapter's default password: must choose their own at next sign-in. */
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  /**
   * False for admin-only accounts (e.g. the chapter's app admin login): they
   * never appear in attendance, PALMS, the member list or celebrations.
   */
  isChapterMember: boolean("is_chapter_member").notNull().default(true),
  joinedOn: date("joined_on"),
  calendarToken: text("calendar_token")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID().replaceAll("-", "")),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const term = pgTable("term", {
  id: id(),
  name: text("name").notNull(),
  startsOn: date("starts_on").notNull(),
  endsOn: date("ends_on").notNull(),
  createdAt: createdAt(),
});

export const roleAssignment = pgTable(
  "role_assignment",
  {
    id: id(),
    termId: text("term_id")
      .notNull()
      .references(() => term.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("role_assignment_unique").on(t.termId, t.memberId, t.role)],
);

/* ------------------------------------------------------------------ */
/* Devices and kiosks                                                  */
/* ------------------------------------------------------------------ */

export const DEVICE_STATUSES = ["pending", "approved", "revoked"] as const;

/**
 * A member's phone, identified by a non-extractable ECDSA key that lives
 * in the browser. A key belongs to exactly one member (unique thumbprint)
 * and a member has at most one approved device (partial unique index).
 */
export const device = pgTable(
  "device",
  {
    id: id(),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    keyThumbprint: text("key_thumbprint").notNull().unique(),
    publicKeyJwk: jsonb("public_key_jwk").$type<JsonWebKey>().notNull(),
    label: text("label").notNull(),
    userAgent: text("user_agent"),
    status: text("status", { enum: DEVICE_STATUSES }).notNull().default("pending"),
    approvalCode: text("approval_code").notNull(),
    createdAt: createdAt(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    approvedById: text("approved_by_id").references(() => member.id),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedById: text("revoked_by_id").references(() => member.id),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [
    index("device_member_idx").on(t.memberId),
    uniqueIndex("device_one_approved_per_member")
      .on(t.memberId)
      .where(sql`${t.status} = 'approved'`),
  ],
);

export const kiosk = pgTable("kiosk", {
  id: id(),
  label: text("label").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  createdById: text("created_by_id").references(() => member.id),
  createdAt: createdAt(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const kioskPairingCode = pgTable("kiosk_pairing_code", {
  id: id(),
  codeHash: text("code_hash").notNull().unique(),
  label: text("label").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdById: text("created_by_id").references(() => member.id),
  createdAt: createdAt(),
});

/* ------------------------------------------------------------------ */
/* Venues, meetings and attendance                                     */
/* ------------------------------------------------------------------ */

/* No geofence (removed Oct 2026): check-in doesn't use location, so a venue has no map pin. */
export const venue = pgTable("venue", {
  id: id(),
  name: text("name").notNull(),
  address: text("address"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: createdAt(),
});

export const MEETING_KINDS = ["weekly", "visitor_day", "event", "training", "other"] as const;
export const MEETING_MODES = ["in_person", "online"] as const;
export const MEETING_STATUSES = ["scheduled", "finalized", "cancelled"] as const;

export const meeting = pgTable(
  "meeting",
  {
    id: id(),
    kind: text("kind", { enum: MEETING_KINDS }).notNull().default("weekly"),
    title: text("title").notNull(),
    mode: text("mode", { enum: MEETING_MODES }).notNull().default("in_person"),
    venueId: text("venue_id").references(() => venue.id),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    checkinOpensAt: timestamp("checkin_opens_at", { withTimezone: true }).notNull(),
    /** Minutes after start before a check-in counts as Late. Always NULL now: the chapter uses no grace. */
    graceMinutes: integer("grace_minutes"),
    qrSecret: text("qr_secret").notNull(),
    status: text("status", { enum: MEETING_STATUSES }).notNull().default("scheduled"),
    headcount: integer("headcount"),
    /** Visitors at the meeting, entered by the LVH team. */
    visitorCount: integer("visitor_count"),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    finalizedById: text("finalized_by_id").references(() => member.id),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("meeting_starts_idx").on(t.startsAt)],
);

/** In PALMS order: Present, Absent, Late, Medical, Substitute. */
export const ATTENDANCE_STATUSES = ["P", "A", "L", "M", "S"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const ATTENDANCE_METHODS = ["self_qr", "lvh_scan", "manual", "auto", "substitute"] as const;
export type AttendanceMethod = (typeof ATTENDANCE_METHODS)[number];

export const attendance = pgTable(
  "attendance",
  {
    meetingId: text("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    status: text("status", { enum: ATTENDANCE_STATUSES }).notNull(),
    method: text("method", { enum: ATTENDANCE_METHODS }).notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    deviceId: text("device_id").references(() => device.id),
    flags: jsonb("flags").$type<string[]>().notNull().default([]),
    note: text("note"),
    setById: text("set_by_id").references(() => member.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.meetingId, t.memberId] }),
    // NULLs are distinct, so this only constrains rows that used a device.
    uniqueIndex("attendance_one_per_device").on(t.meetingId, t.deviceId),
  ],
);

export const checkinAttempt = pgTable(
  "checkin_attempt",
  {
    id: id(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    meetingId: text("meeting_id").references(() => meeting.id, { onDelete: "cascade" }),
    memberId: text("member_id").references(() => member.id, { onDelete: "cascade" }),
    deviceId: text("device_id").references(() => device.id, { onDelete: "set null" }),
    via: text("via", { enum: ["self_qr", "lvh_scan"] }).notNull(),
    result: text("result", { enum: ["ok", "rejected"] }).notNull(),
    reason: text("reason").notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [
    index("checkin_attempt_member_at_idx").on(t.memberId, t.at),
    index("checkin_attempt_meeting_at_idx").on(t.meetingId, t.at),
  ],
);

export const LEAVE_KINDS = ["medical", "informed"] as const;
export const LEAVE_STATUSES = ["pending", "approved", "rejected"] as const;

export const leaveRequest = pgTable(
  "leave_request",
  {
    id: id(),
    meetingId: text("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: LEAVE_KINDS }).notNull(),
    reason: text("reason"),
    status: text("status", { enum: LEAVE_STATUSES }).notNull().default("pending"),
    decidedById: text("decided_by_id").references(() => member.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("leave_request_unique").on(t.meetingId, t.memberId)],
);

export const substitute = pgTable(
  "substitute",
  {
    id: id(),
    meetingId: text("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    business: text("business"),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }),
    confirmedById: text("confirmed_by_id").references(() => member.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("substitute_unique").on(t.meetingId, t.memberId)],
);

/**
 * Visitors at a meeting, for PALMS and follow-up. `meeting.visitor_count` is
 * the number counted at the door; these are the ones whose details were taken,
 * so there can be fewer rows than the count.
 */
export const visitor = pgTable(
  "visitor",
  {
    id: id(),
    meetingId: text("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    business: text("business"),
    category: text("category"),
    /** The member who invited them. */
    invitedById: text("invited_by_id").references(() => member.id, { onDelete: "set null" }),
    note: text("note"),
    createdById: text("created_by_id").references(() => member.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("visitor_meeting_idx").on(t.meetingId)],
);

export const absenceFollowup = pgTable(
  "absence_followup",
  {
    meetingId: text("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    calledById: text("called_by_id").references(() => member.id),
    calledAt: timestamp("called_at", { withTimezone: true }),
    note: text("note"),
  },
  (t) => [primaryKey({ columns: [t.meetingId, t.memberId] })],
);

/* ------------------------------------------------------------------ */
/* Profiles and locations                                              */
/* ------------------------------------------------------------------ */

export type Socials = {
  instagram?: string;
  facebook?: string;
  linkedin?: string;
  youtube?: string;
  x?: string;
};

export const memberProfile = pgTable("member_profile", {
  memberId: text("member_id")
    .primaryKey()
    .references(() => member.id, { onDelete: "cascade" }),
  about: text("about"),
  website: text("website"),
  whatsapp: text("whatsapp"),
  socials: jsonb("socials").$type<Socials>().notNull().default({}),
  videoUrl: text("video_url"),
  logoKey: text("logo_key"),
  /** For the Head Table's celebrations list. */
  dateOfBirth: date("date_of_birth"),
  anniversaryDate: date("anniversary_date"),
  updatedAt: updatedAt(),
});

export const LOCATION_PRECISIONS = ["exact", "area"] as const;

export const memberLocation = pgTable("member_location", {
  memberId: text("member_id")
    .primaryKey()
    .references(() => member.id, { onDelete: "cascade" }),
  address: text("address"),
  area: text("area"),
  city: text("city"),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  /** What other members see. Equal to lat/lng for "exact", rounded for "area". */
  displayLat: doublePrecision("display_lat").notNull(),
  displayLng: doublePrecision("display_lng").notNull(),
  precision: text("precision", { enum: LOCATION_PRECISIONS }).notNull().default("exact"),
  visible: boolean("visible").notNull().default(false),
  updatedAt: updatedAt(),
});

/* ------------------------------------------------------------------ */
/* Calendar, dance card, recognitions, forms                           */
/* ------------------------------------------------------------------ */

export const CALENDAR_KINDS = [
  "event",
  "training",
  "feature_presentation",
  "education_slot",
  "other",
] as const;
export type CalendarKind = (typeof CALENDAR_KINDS)[number];

export const calendarEvent = pgTable(
  "calendar_event",
  {
    id: id(),
    kind: text("kind", { enum: CALENDAR_KINDS }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    location: text("location"),
    link: text("link"),
    memberId: text("member_id").references(() => member.id, { onDelete: "set null" }),
    meetingId: text("meeting_id").references(() => meeting.id, { onDelete: "cascade" }),
    createdById: text("created_by_id").references(() => member.id),
    createdAt: createdAt(),
  },
  (t) => [index("calendar_event_starts_idx").on(t.startsAt)],
);

export const danceCard = pgTable("dance_card", {
  memberId: text("member_id")
    .primaryKey()
    .references(() => member.id, { onDelete: "cascade" }),
  data: jsonb("data").$type<Record<string, string>>().notNull().default({}),
  updatedAt: updatedAt(),
});

export const awardType = pgTable("award_type", {
  id: id(),
  name: text("name").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  /** Whether the Head Table can add a note / a value (e.g. "Rs 20 lakh") for this recognition. */
  noteEnabled: boolean("note_enabled").notNull().default(true),
  valueEnabled: boolean("value_enabled").notNull().default(true),
  valueHint: text("value_hint"),
});

export const award = pgTable(
  "award",
  {
    id: id(),
    meetingId: text("meeting_id")
      .notNull()
      .references(() => meeting.id, { onDelete: "cascade" }),
    awardTypeId: text("award_type_id")
      .notNull()
      .references(() => awardType.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    note: text("note"),
    value: text("value"),
    published: boolean("published").notNull().default(false),
    createdById: text("created_by_id").references(() => member.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("award_unique").on(t.meetingId, t.awardTypeId)],
);

/* ------------------------------------------------------------------ */
/* Suggestions & feedback                                              */
/* ------------------------------------------------------------------ */

export const FEEDBACK_KINDS = ["suggestion", "feedback"] as const;
export const FEEDBACK_STATUSES = ["new", "in_progress", "done"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: FEEDBACK_KINDS }).notNull(),
    message: text("message").notNull(),
    /** The Head Table sees "Anonymous" instead of the member's name. */
    anonymous: boolean("anonymous").notNull().default(false),
    status: text("status", { enum: FEEDBACK_STATUSES }).notNull().default("new"),
    /** The Head Table's reply, shown to the member. */
    response: text("response"),
    respondedById: text("responded_by_id").references(() => member.id),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("feedback_created_idx").on(t.createdAt), index("feedback_member_idx").on(t.memberId)],
);

/* Forms: the module was removed (Oct 2026). The tables stay so earlier responses aren't lost. */

export const FORM_KINDS = [
  "custom",
  "visitor_registration",
  "visitor_feedback",
  "event_registration",
  "survey",
] as const;
export const FORM_VISIBILITIES = ["public", "members"] as const;
export const FORM_FIELD_TYPES = [
  "short_text",
  "long_text",
  "number",
  "email",
  "phone",
  "single_choice",
  "multi_choice",
  "dropdown",
  "rating",
  "date",
  "yes_no",
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];
export type FormField = {
  id: string;
  type: FormFieldType;
  label: string;
  help?: string;
  required: boolean;
  options?: string[];
};

export const form = pgTable("form", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  kind: text("kind", { enum: FORM_KINDS }).notNull().default("custom"),
  fields: jsonb("fields").$type<FormField[]>().notNull().default([]),
  visibility: text("visibility", { enum: FORM_VISIBILITIES }).notNull().default("members"),
  opensAt: timestamp("opens_at", { withTimezone: true }),
  closesAt: timestamp("closes_at", { withTimezone: true }),
  maxResponses: integer("max_responses"),
  onePerMember: boolean("one_per_member").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdById: text("created_by_id").references(() => member.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const formResponse = pgTable(
  "form_response",
  {
    id: id(),
    formId: text("form_id")
      .notNull()
      .references(() => form.id, { onDelete: "cascade" }),
    memberId: text("member_id").references(() => member.id, { onDelete: "set null" }),
    data: jsonb("data").$type<Record<string, string | string[]>>().notNull(),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [index("form_response_form_idx").on(t.formId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Notifications, audit, settings                                      */
/* ------------------------------------------------------------------ */

export const notification = pgTable(
  "notification",
  {
    id: id(),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notification_member_idx").on(t.memberId, t.createdAt)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorId: text("actor_id").references(() => member.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    reason: text("reason"),
  },
  (t) => [index("audit_log_at_idx").on(t.at)],
);

export const setting = pgTable("setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
  updatedById: text("updated_by_id").references(() => member.id),
});
