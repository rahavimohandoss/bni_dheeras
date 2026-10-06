-- Step 1 of 2 for removing the geofence. The app no longer reads or writes the
-- venue pin, the geofence radius or check-in GPS. New venues have no pin, so
-- the pin columns must accept NULL until 0004 drops all of these columns.
-- Split in two so the previous deployment keeps working while this one builds.
ALTER TABLE "venue" ALTER COLUMN "lat" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "venue" ALTER COLUMN "lng" DROP NOT NULL;
