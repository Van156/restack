CREATE TYPE "waiter_call_reason" AS ENUM('need_something', 'cutlery_napkins', 'pay');--> statement-breakpoint
CREATE TYPE "waiter_call_status" AS ENUM('open', 'on_the_way', 'attended');--> statement-breakpoint
CREATE TABLE "waiter_call" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"table_session_id" text NOT NULL,
	"reason" "waiter_call_reason" NOT NULL,
	"status" "waiter_call_status" DEFAULT 'open'::"waiter_call_status" NOT NULL,
	"created_at" timestamp NOT NULL,
	"acknowledged_at" timestamp,
	"acknowledged_by_member_id" text,
	"resolved_at" timestamp,
	"resolved_by_member_id" text,
	"cooldown_until" timestamp,
	"guest_fingerprint" text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "waiterCall_session_unfinished_unique" ON "waiter_call" ("table_session_id") WHERE "status" <> 'attended';--> statement-breakpoint
CREATE INDEX "waiterCall_location_status_idx" ON "waiter_call" ("location_id","status");--> statement-breakpoint
ALTER TABLE "waiter_call" ADD CONSTRAINT "waiter_call_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "waiter_call" ADD CONSTRAINT "waiter_call_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "waiter_call" ADD CONSTRAINT "waiter_call_table_session_id_table_session_id_fkey" FOREIGN KEY ("table_session_id") REFERENCES "table_session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "waiter_call" ADD CONSTRAINT "waiter_call_acknowledged_by_member_id_member_id_fkey" FOREIGN KEY ("acknowledged_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "waiter_call" ADD CONSTRAINT "waiter_call_resolved_by_member_id_member_id_fkey" FOREIGN KEY ("resolved_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL;