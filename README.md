# BNI Dheeras Chapter App

Chapter app for BNI Dheeras (Madurai):

- **Attendance:** self-scan of a rotating QR, PALMS summary and absence alerts.
- **Members:** profiles and a nearest-to-farthest map.
- **Chapter life:** calendar, 1-to-1 dance cards with PDF, weekly recognitions, forms.

The design, loophole list and decisions are in [docs/PLAN.md](docs/PLAN.md).

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16.3 (App Router, Turbopack, React Compiler), React 19, TypeScript |
| UI | Tailwind CSS v4, shadcn/ui (Radix), BNI brand colours |
| Database | Neon Postgres in production; [PGlite](https://pglite.dev) locally. Same `pg` driver for both, via Drizzle ORM. |
| Auth | Better Auth: email one-time code, no passwords, no self sign-up |
| Images | Cloudflare R2 (presigned uploads, compressed to WebP in the browser) |
| Maps | Leaflet + OpenStreetMap (free), address search via Nominatim |
| Email | Resend |
| Hosting | Vercel (functions in `sin1`, next to Neon Singapore) |

## Run it locally

Needs Node.js 22+.

```bash
npm install
cp .env.example .env.local      # then set BETTER_AUTH_SECRET and SETUP_TOKEN
npm run db:local                # terminal 1: local Postgres (PGlite) on port 5433, keep it running
npm run db:migrate              # terminal 2: create the tables
npm run seed                    # optional: demo chapter (12 members, venue, meetings)
npm run dev                     # http://localhost:3000
```

- **Signing in locally:** without `RESEND_API_KEY`, the 6-digit login code is printed in the `npm run dev` terminal. The demo admin is `admin@dheeras.test`.
- **Without demo data:** open `/setup`, enter `SETUP_TOKEN` and create the first admin.
- **Dev-only test tools:** on the Check in page you can paste a kiosk token and pretend to be at the venue. They are compiled out of production builds, and the server still runs every check.

### Testing on a real phone

Camera, GPS and the device key (WebCrypto) only work over HTTPS. The easiest way is a Vercel preview deployment.

On iPhone, use **Share → Add to Home Screen** first, then register the phone from the installed app. iPhone keeps the Home-Screen app's storage separate from Safari's.

## Deploy (production)

1. **Neon:** create a project in **AWS Singapore**.
   - Copy the *pooled* connection string (host contains `-pooler`).
   - Create the tables once:
     ```bash
     DATABASE_URL="postgres://…-pooler…/neondb?sslmode=require" npx drizzle-kit migrate
     ```
2. **Cloudflare R2:** create a bucket.
   - Make it public through a custom domain (or the r2.dev URL). That URL becomes `R2_PUBLIC_BASE_URL`.
   - Create an R2 API token with *Object Read & Write* on the bucket.
   - Add a CORS rule so the browser can upload:
     ```json
     [{ "AllowedOrigins": ["https://YOUR-APP-DOMAIN"], "AllowedMethods": ["PUT"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
     ```
3. **Resend:** verify your sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM`.
4. **Vercel:** import the repository and add every variable from [.env.example](.env.example), with `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` set to your domain.
   - [vercel.json](vercel.json) pins functions to `sin1` and schedules the Monday attendance report (09:00 IST). Set `CRON_SECRET`.
   - The Hobby (free) plan is meant for non-commercial use. Check Vercel's terms for a chapter app.
5. **First admin:** with `SETUP_TOKEN` set, open `https://YOUR-APP-DOMAIN/setup`. Afterwards, remove `SETUP_TOKEN`.
6. **Optional:**
   - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`: spam check on public forms.
   - `NOMINATIM_EMAIL`: contact address for OpenStreetMap's address search.

## Chapter rollout checklist

1. **Admin → Venues:** put the pin on the meeting hall; geofence 150 m.
2. **Admin → Meetings → Weekly series:**
   - day and time;
   - grace minutes (empty means late counts from the exact start time).
3. **Admin → Members → Import CSV:** BNI Connect roster saved as CSV, or add members one by one.
4. **Admin → Roles & terms:**
   - President, VP, Secretary/Treasurer, LVH team, Attendance Coordinator, Membership Committee, coordinators.
   - The app refuses to give one person both device-approval and manual check-in roles.
5. **Device-setup meeting:**
   - every member installs the app (Add to Home Screen) and taps *Register this phone*;
   - the Attendance Coordinator approves each phone face-to-face by matching the 4-digit code.
6. **LVH desk → Pair a venue screen:** pair the projector laptop and open the meeting's QR.
7. **Shadow run:** run two meetings alongside the current method, compare PALMS, then switch over.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run db:local` | Local PGlite Postgres on port 5433 (data in `.data/`) |
| `npm run db:generate` | New SQL migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations to `DATABASE_URL` |
| `npm run seed` | Demo data (local databases only) |
| `npm test` | Unit tests (QR tokens, geofence, late rule, device signatures, forms…) |
| `npm run typecheck` / `npm run lint` / `npm run build` | Checks and production build |

## Where things are

| Path | Contents |
|---|---|
| `src/lib/attendance/` | Check-in rules:<br>• `service.ts`: the seven checks, LVH pass scan, manual check-in, finalize<br>• `qr-token.ts`: rotating HMAC token<br>• `device-crypto.ts`: device-key signatures<br>• `geo.ts`: geofence |
| `src/lib/device-key.ts` | The phone's non-extractable signing key (browser side) |
| `src/actions/` | Server actions. Every one checks the session and the caller's capability. |
| `src/lib/permissions.ts` | Roles → capabilities, separation-of-duties rule |
| `src/app/kiosk/` | Venue screen (rotating QR, welcome wall) |
| `src/app/(app)/lvh/` | LVH desk and live board |
| `src/db/schema.ts` | All tables; migrations are in `drizzle/` |

## Known limits

- **Proxies inside the venue can't be fully blocked.** A web app can't detect fake-GPS apps or a member handing their phone to someone in the room. These cases are made visible instead: names on the venue screen, flags, and the headcount check (see PLAN §1 and §4.3). With the selfie check turned off, this visibility is the only control for a phone handed over inside the venue.
- **Tamil text in the dance-card PDF** needs a Tamil font added to the PDF renderer. English works today.
- **OpenStreetMap's public tile server** is fine for a chapter. For heavier use, set `NEXT_PUBLIC_MAP_TILE_URL` to another tile provider.
