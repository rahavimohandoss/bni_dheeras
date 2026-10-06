# BNI Dheeras Chapter App — Build Plan

**Status:** v1.3 · decisions confirmed 5 Oct 2026, changes D8 and D9 on 6 Oct 2026 · first build done (see §13)
**Scope:** every feature in the "BNI Dheeras Chapter App: Features" sheet, with two changes:

1. **Attendance:** the LVH team no longer scans each member's QR. Instead a QR is shown on the venue screen and every member scans it. Nobody can mark attendance for someone else.
2. **Location:** members save their business location. Any member can see all the others sorted nearest → farthest from their own location, in a list view and a map view.

> **Confirmed decisions (5 Oct 2026). Where the draft below differs, these win:**
> - **D1 Login:** mobile number (or email) and password. This replaced email codes, and then WhatsApp login links.
>   - Every member starts on the chapter's default password and must choose their own at the first sign-in.
>   - Members stay signed in until they sign out.
>   - A forgotten password is reset to the default by the President, VP or Secretary. Nobody can reset someone with more access than themselves.
> - **D2 Maps:** free Leaflet + OpenStreetMap, with Nominatim address search (no Google Maps).
> - **D3 Hosting:** Vercel free (Hobby) plan.
> - **D4 Selfie check:** not used.
> - **D5 Late:** counts from the exact start time, with no grace period (the per-meeting grace field was removed on 6 Oct 2026). The geofence was removed later the same day (D9).
> - **D6:** Dheeras only, so no multi-chapter `chapter_id`.
> - **D7 President = Admin:** the President of the current term has exactly the same access as an Admin, including the exemption from the separation-of-duties rule (§3). It follows the role, so it moves to the new President when the term changes.
> - **D8 Changes (6 Oct 2026):**
>   - **Forms removed.** Old form responses stay in the database. Visitors are now counted with −/+ on the LVH board and the PALMS summary.
>   - **Suggestions & feedback** replaces it. Any member sends one; the President, VP, Secretary and admins read it, reply and set a status. "Hide my name" hides the sender from the Head Table, the notification and the audit log.
>   - **Celebrations.** Members add their date of birth and wedding anniversary in My profile. The President, VP and Secretary see this month's and next month's on Home, and the whole year on the Celebrations page.
>   - **Admin-only accounts are not chapter members** (for example "BNI Dheeras Admin"). They never check in and are left out of PALMS, absences, the directory, Near me, recognitions, celebrations and the Monday report.
>   - **Settings → Attendance rules** keeps only: check-in opens before start, absence limit and window, and the lateness flag count. Default grace and the lateness-flag window (weeks) are no longer in Settings and keep their built-in values. (The geofence and GPS settings went too, and then the geofence itself, D9.)
>   - **Recognitions:** each award has only the fields it needs. Best Attire is winner only; Best 30-Second Presentation has no value; Star of the Week has no note and its value is the visitor count; Top Business Giver's value reads like "Rs 20 lakh".
> - **D9 No geofence (6 Oct 2026):** check-in no longer reads the phone's location.
>   - Removed: the location check, the venue map pin and radius, the per-meeting radius, the GPS settings, the GPS flags, and the check-in GPS stored so far.
>   - Members don't need to allow location to check in, so GPS problems can't cause a false Absent or Late.
>   - The cost: the QR's 30-second life is the only thing tying a check-in to the room. Someone in the room can send a photo or video of the venue screen to an absent member, who can scan it in time (T3, T4 in §4.3). That check-in still shows the member's name on the venue screen and adds to the check-in count that the headcount must match before finalize.
>   - The device rules are unchanged: one approved phone per member, one member per phone (T1, T2).

---

## 0. Summary

- **Stack:** Next.js 16.3 + TypeScript, Neon Postgres + Drizzle, Neon Object Storage for images, Better Auth (mobile number + password), Tailwind v4 + shadcn/ui in BNI colours. Ships as an installable PWA.
- **Attendance:** the QR on the venue screen changes every 15 seconds, and members scan it inside the app. A check-in counts only if all six checks in §4.2 pass. The main ones: the request comes from that member's single approved phone, and the QR is under 30 seconds old. Location isn't checked (D9).
- **"One person, many logins" is blocked by design.** A phone can belong to only one member, and each member has only one approved phone. Logging into a second account on the same phone checks nobody in, and a new phone needs a person to approve it.
- **Cheating that software can't block is made visible:**
  - every check-in shows the member's name and photo on the venue screen;
  - LVH sees rejected attempts as they happen;
  - a physical headcount must match the check-ins before the meeting is finalized.
- **Location:** members can opt in to pin their business. The list and map show all members nearest → farthest, measured from your business location or your current GPS.
- **Build order:** Foundation → Attendance (plus a 2-meeting shadow run) → Profile & Location → Calendar & Recognitions → Dance Card → Suggestions & feedback, celebrations → Launch.

## 1. Hard truths before we build

1. **No web app can close every loophole.** If a member hands their unlocked phone to someone at the venue, software alone can't tell. This design *blocks* proxies through extra accounts. Other proxies become *visible and recorded*. Since D9 that includes a member outside the venue scanning a QR forwarded from the room within 30 seconds. Hardware-level checks (device attestation) need a native app, which is listed under Later.
2. **False absences are a bigger risk than fraud.** Dheeras attendance was 98.4%, #1 of 14 chapters in Madurai region (March 2026 data). If a camera permission or a flat battery marks a present member "Absent" or "Late", members will quickly stop trusting the app. (GPS problems were a third cause until the geofence was removed, D9.) Three things guard against this:
   - the LVH fallbacks in §4.4;
   - all timing comes from the server;
   - a **2-meeting shadow run** before app attendance becomes official.
3. **Keep duties separate.** The person who approves devices must not also be able to check people in manually. Otherwise one person can reopen the loophole. Default: the Attendance Coordinator and Secretary/Treasurer approve devices, and the LVH team does manual check-ins. Every action is audit-logged.
4. **"Business address only" doesn't work for home-based members** such as insurance agents and consultants, because their business address *is* their home. The app adds an "area only" mode for them.
5. **Leadership changes every term** (a new term starts this month). Roles are stored as data assigned per term, with no names hard-coded.

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.3** (latest stable on npm: 16.3.8), App Router, React 19, TypeScript, Turbopack | Server Components + Server Actions; `proxy.ts` gates routes. Runs on Node 22 LTS. |
| Database | **Neon Postgres** in AWS Singapore, the nearest region (Neon has no India region) | `main` + `dev` branches; point-in-time restore |
| ORM | Drizzle ORM + drizzle-kit migrations, `@neondatabase/serverless` | |
| Auth | Better Auth with mobile number (or email) and password, via our own server actions (guessing limits, default-password rules, audit log). Sessions are stored in the database and extended on every visit. | Roles come from our own `role_assignments` table |
| Images | **Neon Object Storage** (S3-compatible, same Neon project; R2 also works). Images are compressed to WebP in the browser, then uploaded through the app server, which checks the file type. | Free plan includes 5 GB |
| UI | Tailwind CSS v4 + shadcn/ui; BNI Red `#CF2030`, Granite Grey `#64666A`; Helvetica Neue with Arial fallback | Follows BNI brand guidelines |
| App shell | Installable PWA (manifest, icons, "Add to Home Screen") | No app store needed |
| Maps | Leaflet + OpenStreetMap tiles; address search through Nominatim (free) | Decision D2 |
| QR | `qrcode` to draw the QR; a JS/WASM decoder (zxing-wasm) for the in-app scanner | Works on iPhone and Android |
| PDF | `pdf-lib` in a route handler | Writes dance-card answers onto the chapter's own printed card |
| Email | Resend (optional) | Email copies of alerts and the Monday report only |
| Hosting | Vercel (Hobby), with functions pinned to `sin1` next to the database | Decision D3 |
| Quality | Zod validation; Vitest for rules, tokens and distance; Playwright end-to-end tests with a mocked camera; Sentry | |

## 3. Roles & permissions

Roles are assigned per **term**, and one member can hold several.

| Capability | Member | LVH team | Attendance Coord. | Sec / Treasurer | VP | President, Admin |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| Own profile, location, dance card, check-in | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Run kiosk QR + LVH live board | | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manual check-in, confirm substitutes (reason required) | | ✓ | | | | ✓ |
| Approve devices, approve medical leave | | | ✓ | ✓ | | ✓ |
| Finalize meeting (and reopen it to correct a status), PALMS summary | | Captain | ✓ | ✓ | view | ✓ |
| Weekly recognitions (Head Table) | | | | ✓ | ✓ | ✓ |
| Calendar (each coordinator edits own slot type) | | | | ✓ | ✓ | ✓ |
| Send a suggestion or feedback | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Read and reply to suggestions; see birthdays and anniversaries | | | | ✓ | ✓ | ✓ |
| Members, roles, settings, audit log | | | | members, audit log | | ✓ |

Admin is a technical super-user, and the President of the current term has exactly the same access (decision D7). Both are exempt from the separation-of-duties rule (a device approver can't also do manual check-ins), so every action either of them takes is audit-logged.

## 4. Attendance

### 4.1 Meeting-day flow

**Before the meeting**

- Weekly meetings are created automatically from a recurrence. Each meeting has its own venue, so a Visitor Day at a different hall works.
- Each meeting has three time windows:
  - check-in opens (default: 60 minutes before start);
  - after the start time, check-ins count as Late (decision D5, no grace period);
  - check-in closes when the meeting ends.
- Online meetings work the same way (the QR is shown on the shared screen); LVH can also confirm attendance from the participant list.
- Up to the start time, a member can:
  - request **medical leave** (becomes M once approved);
  - **register a substitute** with name, phone and business (becomes S once LVH confirms the substitute arrived; A if they don't show);
  - **give notice of an absence** (still counts as A, but is marked "informed").

  After the start time, only LVH or the Secretary can record these.

**At the venue**

- A **paired kiosk** runs on the projector laptop, a TV or a tablet. It is paired once with a one-time code and can only display. It shows:
  - a large QR that changes every 15 seconds, with a countdown;
  - a live count ("38 / 57 in");
  - a welcome ticker with the name and photo of each member who checks in.
- **Member steps:**
  1. Open the app and tap *Scan to check in*.
  2. Scan the QR with the in-app camera.
  3. The phone signs the request. No location is read (D9).
  4. The result appears in about 2 seconds: "Checked in 6:52 AM — on time" or "Late — 7:08 AM".
- Failure messages are plain:
  - "QR expired — scan the screen again"
  - "This phone is registered to another member"
  - "Your phone is waiting for approval — see the Attendance Coordinator"
- **LVH live board** (on a phone or tablet) has five lists:
  - Checked in;
  - Not yet, with leave/substitute info and a call button;
  - Rejected attempts: who and why;
  - Substitutes to confirm;
  - Visitors: a −/+ count, which can also be corrected on the PALMS summary.

**After the meeting**

- **Finalize**, done by the LVH Captain or the Secretary:
  1. Enter the physical member headcount.
  2. The app shows any mismatch with the check-ins, flagged ones first.
  3. Resolve the mismatch, then finalize.
- On finalize:
  - members with no record become A;
  - approved medical leave becomes M;
  - confirmed substitutes become S.

  The meeting is then locked. To fix a wrong status, **Reopen for corrections** on the PALMS summary (Secretary, Attendance Coordinator, LVH Captain, President or Admin, with a reason) unlocks it; LVH corrects it on the board and finalizes again. Both steps are audit-logged.
- Outputs:
  - **PALMS summary for BNI Connect entry:** every member with P/A/L/M/S, substitute names and visitor count. Can be copied to the clipboard, downloaded as CSV or printed.
  - **Absentee follow-up list** for the Attendance Coordinator: call each absentee within 24 hours, then tick and add a note.
  - **Monday report** email covering:
    - the last meeting;
    - members at 2 or more absences;
    - lateness flags;
    - follow-up status.

### 4.2 The six checks behind every check-in (all on the server)

There used to be a seventh, **Place** (a geofence around the venue). It was removed on 6 Oct 2026 (D9).


1. **Session:** a logged-in, active member.
2. **Device:** the request is signed by that member's approved device key.
   - The key (ECDSA P-256) is generated in the browser as *non-extractable* and stored in IndexedDB.
   - Only the public key ever reaches the server.
3. **Fresh QR:**
   - The token is HMAC-SHA256 of the meeting and the current 15-second window, keyed with a per-meeting server secret.
   - Only the current or previous window is accepted, so a token is at most 30 seconds old.
   - The QR contains only this token, which is useless outside the app.
4. **Time:** the server clock (Asia/Kolkata) must be within the check-in window. The phone's clock is never used.
5. **Once per member:** the database enforces one check-in per member per meeting. A second scan just shows "Already checked in at 6:52".
6. **Once per device:** the database enforces one check-in per device per meeting.

Every attempt, passed or failed, is stored with a reason code. That one table drives:

- rate limits (for example, 10 tries per 5 minutes per member and per device);
- the "rejected attempts" list on the LVH board;
- anomaly flags, for example two members checking in seconds apart from the same network on the same phone model.

### 4.3 Loophole list (also the test checklist)

| # | Loophole | How it's handled | Outcome |
|---|---|---|---|
| T1 | One person logs into several members' accounts on one phone and checks them all in | A phone's device key can belong to only one member, so other accounts on that phone can't check in. The attempt shows on the LVH board. | Blocked |
| T2 | Someone uses another browser, incognito or a second phone for another member's account | Each member has one approved device. Every device, including the first, must be approved by the Attendance Coordinator or Secretary, ideally face-to-face. The member gets an email for every device change. | Blocked |
| T3 | A photo of the QR is forwarded on WhatsApp | The QR changes every 15 s and expires within 30 s, and the scanner only uses the live camera (no gallery upload). Without the geofence (D9), an absent member who scans the forwarded photo off another screen within 30 s gets in. Their name and photo appear on the venue screen, and the headcount before finalize won't match. | Visible + recorded (was Blocked before D9) |
| T4 | Someone relays the QR over a live video call | As T3: the name and photo appear on the venue screen for the whole room, and the finalize headcount shows the extra check-in. | Visible + recorded |
| T5 | A member hands their phone to someone at the venue | The live wall and the headcount check (selfie check not used, per D4). | Visible + recorded |
| T6 | Scanning twice, or replaying an old QR | One check-in per member per meeting; token window check | Blocked |
| T7 | Checking in before or after the meeting, or on another day | The check-in window and Late status are computed from server time | Blocked |
| T8 | Changing the phone's clock | The phone's time is never used | Blocked |
| T9 | Checking in without the live QR | Location isn't used (D9), but a check-in still needs a QR under 30 s old; with one, this becomes T3 | Blocked |
| T10 | Sharing your password with a friend, or someone using the default password before the member has signed in | Logging in isn't enough; check-in needs the approved device | Blocked |
| T11 | Forging or guessing QR tokens | Tokens use HMAC with a server-only secret per meeting; rate limits apply | Blocked |
| T12 | Opening the kiosk QR page at home | The token endpoint answers only paired kiosks and sessions with LVH or a higher role. Every kiosk session is logged. | Blocked |
| T13 | An LVH member or admin marks a friend present | A reason is required. The audit log records who, when and why. The summary shows a "Manual" badge, and the Secretary sees the manual count per meeting. | Visible + recorded |
| T14 | Editing attendance after the meeting | Finalize locks the meeting; Secretary/Admin edits need a reason and are audit-logged | Controlled |
| T15 | Creating extra fake member accounts | No self sign-up. Accounts come only from the admin roster, and email and phone must be unique. | Blocked |
| T16 | A lost or changed phone used as an excuse | Device change request → approval → the old key is revoked at once | Controlled |

### 4.4 Fallbacks, so members who are present are never marked absent

1. **LVH scans the member's pass.** For a broken camera:
   - the member's app shows a "My check-in pass" QR, signed by their device and rotating every 30 s;
   - an LVH phone scans it.
2. **Manual check-in by LVH.** For a dead battery or no phone. A reason is required, the action is audit-logged and the check-in gets a "Manual" badge.
3. **Kiosk offline.** The kiosk shows a red "offline" banner and LVH switches to fallback 1.

### 4.5 PALMS rules, absence counter, alerts (editable in Settings)

- **P:** on time.
- **L:** after the start time. LVH can also mark L for leaving early.
- **A:** no record at finalize.
- **M:** approved medical leave.
- **S:** substitute confirmed present.
- **Absence counter:** counts A's over a rolling 6 months; M and S don't count. Members see "Absences (last 6 months): 1 of 3".
- **Alerts:**
  - 2nd absence: the member and the Attendance Coordinator are alerted (the GARAM "warn at 2nd absence" rule);
  - 3rd absence: flagged to the Membership Committee;
  - repeated lateness (for example, 3 L's in 8 weeks): coaching flag.

### 4.6 Practical issues the design handles

- **iPhone storage:** a Home Screen app and Safari keep separate storage, and Safari can clear a site's storage after about 7 days without a visit. So iPhone users install the app to the Home Screen first and register their device *inside the installed app*. On Android the app asks for persistent storage.
- **Clearing browser data deletes the device key.** After that, the member has to request a device change. Members are told this at onboarding.
- **Onboarding check:** camera permission, device registration and a test scan of a practice QR. Check-in doesn't need location permission (D9).
- **Device-setup drive:** at one meeting, the LVH team helps every member install the app and log in. The Attendance Coordinator then approves each device on the spot by matching a short code shown on the member's screen. Until a device is approved, the member can use everything except check-in.

## 5. Location — "Members near me"

**Setting your location**

- Toggle **Show my business on the member map**. It is off by default (opt-in).
- Find the spot by **searching the address** or tapping **Use my current location** while at the business, then drag the pin to the exact spot. The app saves the address, area, city and coordinates.
- Choose the precision:
  - *Exact pin* for a shop or office;
  - *Area only* for a home-based business: shows the locality and a pin rounded to about 500 m, with the street address hidden.
- You can hide or delete your location at any time.

**Viewing**

- **Distance from:** *My business location* (default) or *My current location* (a one-time GPS reading that is never saved). If neither is available, the app asks for one.
- **List view:**
  - all opted-in members, nearest → farthest;
  - grouped into *Within 2 km · 2–5 km · 5–10 km · 10 km+*;
  - each row shows photo, name, business, category, area and distance, with **Call · WhatsApp · Directions · Profile** buttons;
  - filters: category search and distance chips.
- **Map view:**
  - the same members and filters;
  - a "You" marker, and member photo markers that cluster when close together;
  - tap a marker for a card with the distance and Directions;
  - a "fit all" button.

  The app remembers whether you last used List or Map.
- Distances are straight-line ("~3.2 km"). **Directions** opens Google Maps for the road route.
- **How it's built:** `member_locations` stores latitude and longitude. The query computes the Haversine distance and sorts ascending. With 57 members nothing heavier is needed; PostGIS is available on Neon if this ever becomes a region-wide directory.
- Locations are visible only to logged-in members and never appear on a public page.

## 6. The rest of the feature sheet

- **Member Profile:**
  - business name, category, about, website, social links, WhatsApp;
  - date of birth and wedding anniversary, seen only by the President, VP and Secretary (for celebrations);
  - business presentation video link (YouTube embed);
  - photo and logo, stored in Neon Object Storage;
  - a member directory with search by name and category.
- **Calendar:**
  - weekly meetings (created automatically), events and trainings;
  - feature presentation slots and education slots, each assigned to a member;
  - month and agenda views, plus a "My slots" filter;
  - add-to-calendar for each event, and a private calendar feed each member can subscribe to in Google or Apple Calendar.

  Each coordinator edits only their own slot type.
- **1-to-1 Dance Card:**
  - The form follows the chapter's printed card ([docs/dance-card-template.pdf](dance-card-template.pdf)) question for question:
    - Biography sheet;
    - GAINS worksheet (4 prompts each for Goals, Accomplishments, Interests, Networks, Skills);
    - Contact sphere (7);
    - Last 10 customers;
    - Ideal referral;
    - Top problem I solve.
  - Name, company, profession and location start from the member's profile.
  - **Download PDF** is that printed card with the answers written on its lines. Long answers shrink to fit, and the form limits each answer to what fits.
  - Other members can view it from the member's profile to prepare for a 1-to-1.
- **Weekly recognitions:**
  - Five awards: Highest Referral Giver, Top Business Giver, Best Attire, Best 30-Second Presentation, Star of the Week.
  - For each meeting, the Head Table picks a member for each award, plus a note and/or value where that award has them (D8). They save it as a draft and publish after the meeting; a published week can be edited or unpublished.
  - Home shows this week's winners; the Awards page shows history and a term leaderboard.
- **Suggestions & feedback** (replaced Forms, D8):
  - Any member sends a suggestion or feedback, optionally hiding their name.
  - The President, VP, Secretary and admins are notified, reply, and mark it New, In progress or Done. The member sees the reply and status on their own page.
- **Celebrations:** birthdays and wedding anniversaries from My profile. The President, VP and Secretary see this month's and next month's on Home, with a "Today" badge, and the full year on the Celebrations page.

## 7. Data model (Neon + Drizzle)

Single chapter (decision D6): tables have no `chapter_id`.

| Table | Holds | Key rules |
|---|---|---|
| `chapters` | Chapter, timezone | |
| `members` | Roster, contact details, photo, status, link to auth user, "chapter member" flag | Email and phone unique; admin-only accounts have the flag off |
| `terms`, `role_assignments` | Who holds which role in which term | |
| `devices` | Public key, status (pending / approved / revoked), device label, approver | Each key unique; one approved device per member |
| `kiosks` | Paired display screens | Token stored hashed; revocable |
| `venues` | Name, address | |
| `meetings` | Type, venue, start, windows, QR secret, status, headcount, visitor count | |
| `attendance` | P/L/A/M/S, method (self / LVH scan / manual / auto), time, device, flags, who set it | One row per member per meeting; each device used once per meeting |
| `checkin_attempts` | Every attempt with a reason code | Feeds rate limits, the LVH board and flags |
| `leave_requests` | Medical leave or informed absence, plus approval | |
| `substitutes` | Substitute details and arrival confirmation | |
| `member_profiles` | Business details, social links, video link, logo, date of birth, anniversary | |
| `member_locations` | Address, area, coordinates, visible, precision | |
| `calendar_events` | Meetings, events, trainings, slots, assigned member | |
| `dance_card_templates`, `dance_cards` | Template fields (JSON) and each member's answers (JSON) | |
| `award_types`, `awards` | The 5 award types and which fields each uses; winners per meeting | One winner per award per meeting |
| `feedback` | Suggestions and feedback, anonymous flag, status, Head Table reply | |
| `forms`, `form_responses` | Left from the removed Forms module (D8), so old responses aren't lost | Not used by the app |
| `notifications` | In-app notices | |
| `audit_log` | Who changed what, before and after, reason | Append-only |
| `settings` | Attendance rules and other config | |

Better Auth adds its own tables (user, session, account, verification).

## 8. Screens and endpoints

- **Member screens:**
  - Home: next meeting with the check-in button, absence counter, this week's winners, upcoming events;
  - Scan;
  - Calendar;
  - Members and member profiles;
  - Near me (List / Map);
  - Dance card;
  - Awards;
  - Suggestions & feedback;
  - Celebrations (President, VP, Secretary);
  - Me: profile, location, device, notifications.
- **LVH screens:**
  - live board at `/lvh/[meetingId]`;
  - kiosk pairing at `/kiosk`;
  - kiosk display at `/kiosk/[meetingId]`.
- **Admin screens:**
  - members and roster import;
  - roles per term;
  - devices;
  - venues and meetings;
  - finalize and PALMS summary;
  - awards, calendar, suggestions & feedback;
  - settings and audit log.
- **Public:** nothing beyond the sign-in page; the kiosk display needs a paired screen.
- **Route handlers:**
  - `POST /api/attendance/check-in`
  - `GET /api/kiosk/[meetingId]/token`
  - `GET /api/lvh/[meetingId]/feed`
  - `POST /api/uploads`
  - `GET /api/dance-card/pdf`
  - `GET /api/calendar/[token].ics`
  - a scheduled job for the Monday report.
- The kiosk and LVH board poll for updates every 2–3 s. For one room this is simple and reliable on serverless hosting.

## 9. Security, privacy, operations

- Every read and action is authorized on the server in a data-access layer. `proxy.ts` only handles quick redirects.
- Cookies are httpOnly and secure. Server Actions have a built-in origin check, Zod validates every input, and security headers are set.
- Image uploads go through the app server: signed-in members only, same-origin, max 3 MB, file bytes checked against the declared type, random object keys.
- Check-in doesn't collect location (D9). The check-in GPS recorded before that was deleted with the geofence.
- At onboarding, a consent screen covers location sharing (India's DPDP Act). Members can ask to have their data deleted, and locations are never public.
- Development uses the Neon `dev` branch and production uses `main`. Migrations run through drizzle-kit in CI, and point-in-time restore is available.

## 10. Build phases

| Phase | Delivers | Done when |
|---|---|---|
| 0. Foundation | App skeleton, BNI theme, Neon + Drizzle, password sign-in, roles per term, image uploads, PWA, CI/CD, roster import (CSV or BNI Connect roster export) | All members can log in and add a photo |
| 1. Attendance | Venues, meetings, device approval, kiosk, scan check-in, LVH board, fallbacks, leave + substitutes, finalize + headcount, PALMS summary, counter, alerts, Monday report, audit log | Every row T1–T16 tested, and 2 meetings shadow-run alongside the current method with matching results |
| 2. Profile + Location | Profile editor, directory, location setup, Near me list + map | Members can find each other nearest → farthest |
| 3. Calendar + Recognitions | Calendar, slots, iCal feed; award entry, home screen winners, history | The Head Table publishes a week's awards |
| 4. Dance Card | Template, editor, PDF | A member downloads their own PDF |
| 5. Suggestions & celebrations | Suggestions & feedback with replies; birthdays and anniversaries for the Head Table (Forms was built here, then removed per D8) | The Head Table replies to a member's suggestion |
| 6. Launch | Security review against the T1–T16 list, performance on low-end Android phones, device-setup drive, one-page guides for LVH and Secretary | The chapter runs fully on the app and the old method is retired |

Attendance comes first because it's the riskiest feature and needs real meetings to tune.

**Later (not in v1):**

- Web Push or WhatsApp reminders.
- Tamil UI.
- If proxy check-ins show up in the data (headcount mismatches): bring back a location check, or a native app wrapper with device attestation.

## 11. Decisions (confirmed 5 Oct 2026; the original draft options are kept below for reference)

| # | Decision | Options |
|---|---|---|
| D1 | Login | **Email OTP (free)** · WhatsApp/SMS OTP (costs per message; SMS also needs DLT registration) |
| D2 | Maps | **Google Maps:** best address search for India; needs a billing account; a chapter's usage should stay within Google's free monthly usage · Leaflet + OpenStreetMap: free, but only pin-drop (no address search) |
| D3 | Hosting | **Vercel Pro** (the Hobby plan is for non-commercial use only) · Cloudflare Workers via OpenNext: everything on Cloudflare, more setup |
| D4 | Selfie check | Off · **Random spot-check, about 1 in 5** · Every check-in |
| D5 | Attendance numbers | Late after start + **5 min**; geofence **200 m**; check-in opens **60 min** before; **3 absences / 6 months** |
| D6 | Ready for other chapters | **Yes** (cheap now, costly to add later) · Dheeras only |

## 12. Inputs needed to start

- **Accounts:** Neon (database + Object Storage), Vercel; optional Resend (email copies).
- **Domain:** the domain or sub-domain for the app.
- **Roster:** BNI Connect Chapter Roster export or a CSV with name, email, phone, company and category.
- **Current-term role holders:** President, VP, Secretary/Treasurer, LVH team, GARAM, coordinators.
- **Venue:**
  - the meeting hall's name and address;
  - meeting day and time;
  - whether there's a projector or TV for the kiosk (otherwise a tablet at the door).
- **Dance card:** the chapter's current dance card (photo or PDF).
- **Branding:** logo and brand assets approved for chapter use.

## 13. Build status (5 Oct 2026)

Built and checked locally (type-check, lint, 29 unit tests, production build, browser walkthrough):

- **Attendance:**
  - venues, weekly meetings, device registration and approval;
  - paired kiosk with rotating QR;
  - member check-in running all its checks (seven then; six since the geofence was removed, D9);
  - LVH live board with pass scan, manual check-in, substitutes and finalize with headcount;
  - PALMS summary (copy, CSV, print), absence counter and alerts, absentee follow-ups, Monday report;
  - audit log.
- **Members:** profile, photo and logo upload, directory, member page.
- **Location:** opt-in pin with *area only* mode; Near me list and map, nearest to farthest.
- **Calendar:** month and agenda views, coordinator-managed slots, private phone-calendar feed.
- **Dance card:** form matching the chapter's printed card, and a PDF that is that card filled in.
- **Weekly recognitions:** admin entry, publishing, history and leaderboard.
- **Forms:** built, then removed on 6 Oct 2026 (D8).
- **Admin:** members (add, edit, CSV import), roles per term with the separation-of-duties check, settings.

Added on 6 Oct 2026 (D8), checked the same way (type-check, lint, 36 unit tests, production build, browser walkthrough):

- Suggestions & feedback, celebrations, date of birth and anniversary in My profile.
- Admin-only accounts left out of attendance and member lists.
- Per-award recognition fields; unpublish.
- Admin clean-up: pagination on long lists; delete and restore for cancelled meetings; reopen a finalized meeting; edit and delete terms; reject a pending phone; delete venues and calendar events with a confirmation; leave decision history; audit log filters; notification delete and "clear read".

Numbered pagination (6 Oct 2026) on every list that keeps growing: recognitions (6 weeks a page, with the term leaderboard counted in the database), admin meetings, calendar items, devices, members, Near me, celebrations (3 months a page), attendance, leave, audit, feedback and notifications.

Removed on 6 Oct 2026 (D9): the geofence and everything tied to it. A check-in with no location was tested end to end (venue QR → "Checked in — Late").

Verified by testing in the browser:

- forged, expired and duplicate QR tokens are rejected;
- check-in without location was rejected (until D9 removed the location check);
- a second member registering an already-registered phone is blocked (T1);
- an Attendance Coordinator gets no manual check-in buttons.

**Not done yet:**

- a 2-meeting shadow run with real phones;
- Tamil font for the PDF;
- Web Push / WhatsApp reminders.

