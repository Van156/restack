CREATE TYPE "location_plan" AS ENUM('esencial', 'completo');--> statement-breakpoint
CREATE TABLE "location" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"is_franchise" boolean DEFAULT false NOT NULL,
	"dian_enabled" boolean DEFAULT false NOT NULL,
	"dian_choice_by_user_id" text,
	"dian_choice_at" timestamp,
	"waiters_can_charge" boolean DEFAULT false NOT NULL,
	"suggested_tip_percent" integer DEFAULT 10 NOT NULL,
	"plan" "location_plan" DEFAULT 'completo'::"location_plan" NOT NULL,
	"trial_ends_at" timestamp,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "location_suggestedTipPercent_check" CHECK ("suggested_tip_percent" >= 0 AND "suggested_tip_percent" <= 10)
);
--> statement-breakpoint
CREATE TABLE "staff_location_assignment" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"member_id" text NOT NULL,
	"location_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "staffLocationAssignment_member_location_unique" UNIQUE("member_id","location_id")
);
--> statement-breakpoint
CREATE INDEX "location_organizationId_idx" ON "location" ("organization_id");--> statement-breakpoint
CREATE INDEX "staffLocationAssignment_organizationId_idx" ON "staff_location_assignment" ("organization_id");--> statement-breakpoint
CREATE INDEX "staffLocationAssignment_locationId_idx" ON "staff_location_assignment" ("location_id");--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_dian_choice_by_user_id_user_id_fkey" FOREIGN KEY ("dian_choice_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "staff_location_assignment" ADD CONSTRAINT "staff_location_assignment_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "staff_location_assignment" ADD CONSTRAINT "staff_location_assignment_member_id_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "staff_location_assignment" ADD CONSTRAINT "staff_location_assignment_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;