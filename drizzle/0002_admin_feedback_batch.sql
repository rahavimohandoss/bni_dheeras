CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"member_id" text NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"anonymous" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"response" text,
	"responded_by_id" text,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "award_type" ADD COLUMN "note_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "award_type" ADD COLUMN "value_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "award_type" ADD COLUMN "value_hint" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "visitor_count" integer;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "is_chapter_member" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "member_profile" ADD COLUMN "date_of_birth" date;--> statement-breakpoint
ALTER TABLE "member_profile" ADD COLUMN "anniversary_date" date;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_member_id_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_responded_by_id_member_id_fk" FOREIGN KEY ("responded_by_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_created_idx" ON "feedback" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "feedback_member_idx" ON "feedback" USING btree ("member_id");--> statement-breakpoint
-- The chapter's app admin login is not a chapter member (no attendance, PALMS, member list).
UPDATE "member" SET "is_chapter_member" = false WHERE "is_admin" = true AND "full_name" = 'BNI Dheeras Admin';--> statement-breakpoint
-- No grace period any more: late counts from the exact start time.
UPDATE "meeting" SET "grace_minutes" = NULL;--> statement-breakpoint
-- Which weekly recognitions take a note and/or a value.
UPDATE "award_type" SET "note_enabled" = true, "value_enabled" = true, "value_hint" = 'e.g. 4 referrals' WHERE "name" = 'Highest Referral Giver';--> statement-breakpoint
UPDATE "award_type" SET "note_enabled" = true, "value_enabled" = true, "value_hint" = 'e.g. Rs 20 lakh' WHERE "name" = 'Top Business Giver';--> statement-breakpoint
UPDATE "award_type" SET "note_enabled" = false, "value_enabled" = false WHERE "name" = 'Best Attire';--> statement-breakpoint
UPDATE "award_type" SET "note_enabled" = true, "value_enabled" = false WHERE "name" = 'Best 30-Second Presentation';--> statement-breakpoint
UPDATE "award_type" SET "note_enabled" = false, "value_enabled" = true, "value_hint" = 'e.g. 3 visitors' WHERE "name" = 'Star of the Week';
