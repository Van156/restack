CREATE TABLE "cash_shift" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"opened_by_member_id" text,
	"opened_at" timestamp NOT NULL,
	"opening_amount" integer NOT NULL,
	"closed_by_member_id" text,
	"closed_at" timestamp,
	"expected" integer,
	"counted" integer,
	"difference" integer,
	"counted_by_tender" jsonb,
	"override_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cashShift_openingAmount_check" CHECK ("opening_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "tip_beneficiary" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"cash_shift_id" text NOT NULL,
	"member_id" text,
	"display_name" text NOT NULL,
	"share_percent" integer,
	"position" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tipBeneficiary_shift_position_unique" UNIQUE("cash_shift_id","position"),
	CONSTRAINT "tipBeneficiary_sharePercent_check" CHECK ("share_percent" IS NULL OR ("share_percent" >= 1 AND "share_percent" <= 100))
);
--> statement-breakpoint
CREATE TABLE "tip_distribution" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"cash_shift_id" text NOT NULL,
	"beneficiary_id" text NOT NULL,
	"member_id" text,
	"display_name" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tipDistribution_shift_beneficiary_unique" UNIQUE("cash_shift_id","beneficiary_id"),
	CONSTRAINT "tipDistribution_amount_check" CHECK ("amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "cash_shift_id" text;--> statement-breakpoint
CREATE INDEX "payment_cashShiftId_idx" ON "payment" ("cash_shift_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cashShift_oneOpenPerLocation_unique" ON "cash_shift" ("location_id") WHERE "closed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "cashShift_organizationId_idx" ON "cash_shift" ("organization_id");--> statement-breakpoint
CREATE INDEX "cashShift_locationId_openedAt_idx" ON "cash_shift" ("location_id","opened_at");--> statement-breakpoint
CREATE INDEX "tipBeneficiary_cashShiftId_idx" ON "tip_beneficiary" ("cash_shift_id");--> statement-breakpoint
CREATE INDEX "tipDistribution_cashShiftId_idx" ON "tip_distribution" ("cash_shift_id");--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_cash_shift_id_cash_shift_id_fkey" FOREIGN KEY ("cash_shift_id") REFERENCES "cash_shift"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "cash_shift" ADD CONSTRAINT "cash_shift_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cash_shift" ADD CONSTRAINT "cash_shift_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "cash_shift" ADD CONSTRAINT "cash_shift_opened_by_member_id_member_id_fkey" FOREIGN KEY ("opened_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "cash_shift" ADD CONSTRAINT "cash_shift_closed_by_member_id_member_id_fkey" FOREIGN KEY ("closed_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "cash_shift" ADD CONSTRAINT "cash_shift_override_id_override_id_fkey" FOREIGN KEY ("override_id") REFERENCES "override"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tip_beneficiary" ADD CONSTRAINT "tip_beneficiary_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tip_beneficiary" ADD CONSTRAINT "tip_beneficiary_cash_shift_id_cash_shift_id_fkey" FOREIGN KEY ("cash_shift_id") REFERENCES "cash_shift"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tip_beneficiary" ADD CONSTRAINT "tip_beneficiary_member_id_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "tip_distribution" ADD CONSTRAINT "tip_distribution_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tip_distribution" ADD CONSTRAINT "tip_distribution_cash_shift_id_cash_shift_id_fkey" FOREIGN KEY ("cash_shift_id") REFERENCES "cash_shift"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tip_distribution" ADD CONSTRAINT "tip_distribution_beneficiary_id_tip_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "tip_beneficiary"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tip_distribution" ADD CONSTRAINT "tip_distribution_member_id_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member"("id") ON DELETE SET NULL;