-- Step 2 of 2 for removing the geofence (see 0003): drop the columns the app
-- stopped using, including the check-in GPS recorded so far.
ALTER TABLE "attendance" DROP COLUMN IF EXISTS "lat";--> statement-breakpoint
ALTER TABLE "attendance" DROP COLUMN IF EXISTS "lng";--> statement-breakpoint
ALTER TABLE "attendance" DROP COLUMN IF EXISTS "accuracy_m";--> statement-breakpoint
ALTER TABLE "attendance" DROP COLUMN IF EXISTS "distance_m";--> statement-breakpoint
ALTER TABLE "checkin_attempt" DROP COLUMN IF EXISTS "distance_m";--> statement-breakpoint
ALTER TABLE "checkin_attempt" DROP COLUMN IF EXISTS "accuracy_m";--> statement-breakpoint
ALTER TABLE "meeting" DROP COLUMN IF EXISTS "geofence_m";--> statement-breakpoint
ALTER TABLE "venue" DROP COLUMN IF EXISTS "lat";--> statement-breakpoint
ALTER TABLE "venue" DROP COLUMN IF EXISTS "lng";--> statement-breakpoint
ALTER TABLE "venue" DROP COLUMN IF EXISTS "geofence_m";
