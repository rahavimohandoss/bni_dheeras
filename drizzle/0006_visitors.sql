CREATE TABLE "visitor" (
	"id" text PRIMARY KEY NOT NULL,
	"meeting_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"business" text,
	"category" text,
	"invited_by_id" text,
	"note" text,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visitor" ADD CONSTRAINT "visitor_meeting_id_meeting_id_fk" FOREIGN KEY ("meeting_id") REFERENCES "public"."meeting"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor" ADD CONSTRAINT "visitor_invited_by_id_member_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."member"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visitor" ADD CONSTRAINT "visitor_created_by_id_member_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."member"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "visitor_meeting_idx" ON "visitor" USING btree ("meeting_id");