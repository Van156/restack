CREATE TABLE "staff_presence" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"member_id" text NOT NULL,
	"last_seen_at" timestamp NOT NULL,
	CONSTRAINT "staffPresence_member_location_unique" UNIQUE("member_id","location_id")
);
--> statement-breakpoint
CREATE INDEX "staffPresence_locationId_idx" ON "staff_presence" ("location_id");--> statement-breakpoint
ALTER TABLE "staff_presence" ADD CONSTRAINT "staff_presence_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "staff_presence" ADD CONSTRAINT "staff_presence_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "staff_presence" ADD CONSTRAINT "staff_presence_member_id_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE;