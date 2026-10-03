CREATE TYPE "override_action" AS ENUM('void_line', 'discount', 'reopen_bill', 'close_shift_difference');--> statement-breakpoint
CREATE TYPE "paired_device_status" AS ENUM('pending', 'active', 'revoked');--> statement-breakpoint
CREATE TABLE "invitation_location" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"invitation_id" text NOT NULL,
	"location_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invitationLocation_invitation_location_unique" UNIQUE("invitation_id","location_id")
);
--> statement-breakpoint
CREATE TABLE "override" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"approver_member_id" text NOT NULL,
	"requester_member_id" text NOT NULL,
	"action" "override_action" NOT NULL,
	"target" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paired_device" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"name" text NOT NULL,
	"status" "paired_device_status" DEFAULT 'pending'::"paired_device_status" NOT NULL,
	"token_hash" text UNIQUE,
	"activation_code_hash" text UNIQUE,
	"activation_expires_at" timestamp,
	"created_by_user_id" text NOT NULL,
	"last_seen_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paired_device_station" (
	"device_id" text NOT NULL,
	"station_id" text NOT NULL,
	CONSTRAINT "pairedDeviceStation_device_station_unique" UNIQUE("device_id","station_id")
);
--> statement-breakpoint
CREATE TABLE "staff_pin" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"member_id" text NOT NULL CONSTRAINT "staffPin_member_unique" UNIQUE,
	"pin_hash" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "invitationLocation_organizationId_idx" ON "invitation_location" ("organization_id");--> statement-breakpoint
CREATE INDEX "override_organizationId_idx" ON "override" ("organization_id");--> statement-breakpoint
CREATE INDEX "pairedDevice_organizationId_idx" ON "paired_device" ("organization_id");--> statement-breakpoint
CREATE INDEX "pairedDevice_locationId_idx" ON "paired_device" ("location_id");--> statement-breakpoint
CREATE INDEX "staffPin_organizationId_idx" ON "staff_pin" ("organization_id");--> statement-breakpoint
ALTER TABLE "invitation_location" ADD CONSTRAINT "invitation_location_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitation_location" ADD CONSTRAINT "invitation_location_invitation_id_invitation_id_fkey" FOREIGN KEY ("invitation_id") REFERENCES "invitation"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "invitation_location" ADD CONSTRAINT "invitation_location_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "override" ADD CONSTRAINT "override_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "override" ADD CONSTRAINT "override_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "override" ADD CONSTRAINT "override_approver_member_id_member_id_fkey" FOREIGN KEY ("approver_member_id") REFERENCES "member"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "override" ADD CONSTRAINT "override_requester_member_id_member_id_fkey" FOREIGN KEY ("requester_member_id") REFERENCES "member"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "paired_device" ADD CONSTRAINT "paired_device_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "paired_device" ADD CONSTRAINT "paired_device_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "paired_device" ADD CONSTRAINT "paired_device_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "paired_device_station" ADD CONSTRAINT "paired_device_station_device_id_paired_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "paired_device"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "paired_device_station" ADD CONSTRAINT "paired_device_station_station_id_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "station"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "staff_pin" ADD CONSTRAINT "staff_pin_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "staff_pin" ADD CONSTRAINT "staff_pin_member_id_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE CASCADE;