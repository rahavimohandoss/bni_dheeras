/**
 * Demo data for LOCAL development only. Refuses to run against a remote
 * database. Creates an admin (admin@dheeras.test), demo members with roles
 * (all on the demo default password), a
 * venue in Madurai, a meeting whose check-in is open now, past meetings with
 * attendance, locations, calendar items, awards and a visitor form.
 *
 *   npm run db:local   (in another terminal)
 *   npm run seed
 */
import { hashPassword } from "better-auth/crypto";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import * as s from "../src/db/schema";
import { newMeetingSecret } from "../src/lib/attendance/qr-token";

/** Local demo only. Everyone starts on it and chooses their own at first sign-in. */
const DEFAULT_PASSWORD = "Dheeras@2026";

const url = process.env.DATABASE_URL ?? "";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
  console.error("Refusing to seed: DATABASE_URL is not a local database.");
  process.exit(1);
}

const MIN = 60_000;
const DAY = 86_400_000;
const now = Date.now();
const uuid = () => crypto.randomUUID();

const people = [
  { name: "Chapter Admin", email: "admin@dheeras.test", business: "MnT", category: "App Developer", admin: true, roles: [] },
  { name: "Arun Kumar", email: "arun@dheeras.test", business: "Arun Foods", category: "Restaurant", roles: ["president"] },
  { name: "Priya Raman", email: "priya@dheeras.test", business: "Priya Tech", category: "Software", roles: ["vice_president"] },
  { name: "Meena Sundar", email: "meena@dheeras.test", business: "Sundar Tax", category: "Tax Advisor", roles: ["secretary_treasurer"] },
  { name: "Karthik Vel", email: "karthik@dheeras.test", business: "Vel Decors", category: "Wall Coverings", roles: ["attendance_coordinator", "membership_committee"] },
  { name: "Divya Prakash", email: "divya@dheeras.test", business: "DP Studio", category: "Photographer", roles: ["lvh_captain"] },
  { name: "Suresh Babu", email: "suresh@dheeras.test", business: "Babu Mattress", category: "Mattresses", roles: ["lvh"] },
  { name: "Lakshmi Devi", email: "lakshmi@dheeras.test", business: "LD Catering", category: "Caterer", roles: [] },
  { name: "Rahul Iyer", email: "rahul@dheeras.test", business: "Iyer Interiors", category: "Interior Design", roles: [] },
  { name: "Fathima Begum", email: "fathima@dheeras.test", business: "FB Insurance", category: "Health Insurance", roles: [] },
  { name: "Gopal Krishnan", email: "gopal@dheeras.test", business: "GK Steels", category: "Iron & Steel", roles: [] },
  { name: "Anitha Mohan", email: "anitha@dheeras.test", business: "Anitha Dental", category: "Dentist", roles: [] },
];

// Points around Madurai (lat, lng) for business locations.
const spots: [number, number, string][] = [
  [9.9252, 78.1198, "Periyar"],
  [9.9312, 78.1213, "Simmakkal"],
  [9.9389, 78.1336, "Tallakulam"],
  [9.9503, 78.1478, "K.K. Nagar"],
  [9.9158, 78.1135, "Madurai Junction"],
  [9.9097, 78.0943, "Palanganatham"],
  [9.9665, 78.1611, "Anna Nagar"],
  [9.8818, 78.0819, "Thirunagar"],
  [9.9843, 78.1395, "Narimedu"],
  [9.8665, 78.0565, "Thirumangalam Rd"],
  [10.0101, 78.1593, "Othakadai"],
  [9.9405, 78.1559, "KK Nagar East"],
];

async function main() {
  const existing = await db.select({ id: s.member.id }).from(s.member).limit(1);
  if (existing.length) {
    console.log("Database already has members; wiping demo tables first.");
    await db.execute(sql`TRUNCATE "user", term, venue, meeting, award_type, form, setting, kiosk, kiosk_pairing_code RESTART IDENTITY CASCADE`);
  }

  await db.insert(s.setting).values({
    key: "attendance",
    value: {
      defaultGraceMinutes: null,
      defaultGeofenceM: 150,
      gpsAccuracyAllowanceM: 50,
      maxGpsAccuracyM: 500,
      checkinOpensBeforeMin: 60,
      absenceLimit: 3,
      absenceWindowMonths: 6,
      lateFlagCount: 3,
      lateFlagWeeks: 8,
    },
  });

  await db.insert(s.setting).values({ key: "defaultPassword", value: DEFAULT_PASSWORD });
  const passwordHash = await hashPassword(DEFAULT_PASSWORD);

  const [t] = await db
    .insert(s.term)
    .values({ name: "Oct 2026 – Mar 2027", startsOn: "2026-10-01", endsOn: "2027-03-31" })
    .returning();

  const ids: string[] = [];
  for (const [i, p] of people.entries()) {
    const id = uuid();
    ids.push(id);
    await db.insert(s.user).values({ id, name: p.name, email: p.email, emailVerified: true });
    await db.insert(s.account).values({ id: uuid(), userId: id, accountId: id, providerId: "credential", password: passwordHash });
    await db.insert(s.member).values({
      id,
      fullName: p.name,
      email: p.email,
      phone: `+9198400${String(10000 + i).slice(-5)}`,
      businessName: p.business,
      category: p.category,
      isAdmin: p.admin ?? false,
      joinedOn: "2025-01-01",
    });
    for (const role of p.roles) await db.insert(s.roleAssignment).values({ termId: t.id, memberId: id, role });
    await db.insert(s.memberProfile).values({
      memberId: id,
      about: `${p.business} serves customers across Madurai.`,
      website: `https://example.com/${p.business.toLowerCase().replace(/\s+/g, "-")}`,
      whatsapp: `+9198400${String(10000 + i).slice(-5)}`,
      socials: {},
    });
    const [lat, lng, area] = spots[i % spots.length];
    await db.insert(s.memberLocation).values({
      memberId: id,
      address: `${area}, Madurai`,
      area,
      city: "Madurai",
      lat,
      lng,
      displayLat: lat,
      displayLng: lng,
      precision: "exact",
      visible: i % 5 !== 4,
    });
  }

  const [venue] = await db
    .insert(s.venue)
    .values({ name: "Demo Hotel Meeting Hall", address: "Periyar, Madurai", lat: 9.9195, lng: 78.1193, geofenceM: 150 })
    .returning();

  const mkMeeting = (startMs: number, title: string, status: "scheduled" | "finalized" = "scheduled") => ({
    id: uuid(),
    kind: "weekly" as const,
    title,
    mode: "in_person" as const,
    venueId: venue.id,
    startsAt: new Date(startMs),
    endsAt: new Date(startMs + 90 * MIN),
    checkinOpensAt: new Date(startMs - 60 * MIN),
    graceMinutes: null,
    qrSecret: newMeetingSecret(),
    status,
    finalizedAt: status === "finalized" ? new Date(startMs + 100 * MIN) : null,
  });

  // Check-in is open right now: the meeting starts in 20 minutes.
  const today = mkMeeting(now + 20 * MIN, "Weekly Meeting");
  const future = [1, 2, 3].map((w) => mkMeeting(now + 20 * MIN + w * 7 * DAY, "Weekly Meeting"));
  const past = [3, 2, 1].map((w) => mkMeeting(now + 20 * MIN - w * 7 * DAY, "Weekly Meeting", "finalized"));
  await db.insert(s.meeting).values([today, ...future, ...past]);

  // Past attendance: mostly present, a few late/absent/substitute/medical.
  const codes = ["P", "P", "P", "L", "P", "A", "P", "S", "P", "M", "P", "P"] as const;
  for (const [w, m] of past.entries()) {
    await db.insert(s.attendance).values(
      ids.map((memberId, i) => {
        const status = codes[(i + w * 3) % codes.length];
        return {
          meetingId: m.id,
          memberId,
          status,
          method: (status === "P" || status === "L" ? "self_qr" : status === "S" ? "substitute" : "auto") as s.AttendanceMethod,
          checkedInAt: status === "P" || status === "L" ? new Date(m.startsAt.getTime() + (status === "L" ? 6 : -10) * MIN) : null,
        };
      }),
    );
  }

  const types = await db
    .insert(s.awardType)
    .values(
      ["Highest Referral Giver", "Top Business Giver", "Best Attire", "Best 30-Second Presentation", "Star of the Week"].map(
        (name, i) => ({ name, sortOrder: i }),
      ),
    )
    .returning();
  await db.insert(s.award).values(
    types.map((ty, i) => ({ meetingId: past[2].id, awardTypeId: ty.id, memberId: ids[(i * 2 + 1) % ids.length], published: true })),
  );

  await db.insert(s.calendarEvent).values([
    {
      kind: "feature_presentation",
      title: "Feature presentation: Lakshmi Devi",
      startsAt: future[0].startsAt,
      endsAt: new Date(future[0].startsAt.getTime() + 10 * MIN),
      memberId: ids[7],
      meetingId: future[0].id,
    },
    {
      kind: "training",
      title: "MSP training",
      startsAt: new Date(now + 4 * DAY),
      endsAt: new Date(now + 4 * DAY + 120 * MIN),
      location: "Online",
    },
    {
      kind: "event",
      title: "Business Builder Breakfast",
      startsAt: new Date(now + 10 * DAY),
      endsAt: new Date(now + 10 * DAY + 180 * MIN),
      location: "Demo Hotel Meeting Hall",
    },
  ]);

  await db.insert(s.form).values({
    slug: "visitor",
    title: "Visitor registration",
    description: "Welcome to BNI Dheeras! Please tell us about you.",
    kind: "visitor_registration",
    visibility: "public",
    fields: [
      { id: "name", type: "short_text", label: "Your name", required: true },
      { id: "phone", type: "phone", label: "Mobile number", required: true },
      { id: "business", type: "short_text", label: "Business name", required: true },
      { id: "category", type: "short_text", label: "Business category", required: true },
      { id: "invited_by", type: "short_text", label: "Invited by (member name)", required: false },
    ],
  });

  console.log(
    `Seeded ${people.length} members. Sign in with a mobile number (admin: 9840010000, President Arun: 9840010001) ` +
      `or email (admin@dheeras.test) and the default password ${DEFAULT_PASSWORD}; you'll then choose your own.`,
  );
}

main()
  .then(() => pool.end())
  .catch(async (e) => {
    console.error(e);
    await pool.end();
    process.exit(1);
  });
