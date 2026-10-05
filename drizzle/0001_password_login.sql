CREATE TABLE "login_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"ip" text,
	"ok" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "must_change_password" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX "login_attempt_identifier_idx" ON "login_attempt" USING btree ("identifier","created_at");--> statement-breakpoint
CREATE INDEX "login_attempt_ip_idx" ON "login_attempt" USING btree ("ip","created_at");