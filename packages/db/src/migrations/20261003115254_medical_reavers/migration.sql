CREATE TYPE "bill_status" AS ENUM('open', 'settled', 'reopened');--> statement-breakpoint
CREATE TYPE "buyer_document_type" AS ENUM('cc', 'ce', 'nit', 'ti', 'pp', 'te');--> statement-breakpoint
CREATE TYPE "payment_tender" AS ENUM('cash', 'card', 'qr_transfer');--> statement-breakpoint
CREATE TABLE "bill" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"table_session_id" text NOT NULL CONSTRAINT "bill_tableSession_unique" UNIQUE,
	"status" "bill_status" DEFAULT 'open'::"bill_status" NOT NULL,
	"tip_amount" integer DEFAULT 0 NOT NULL,
	"tip_updated_by_member_id" text,
	"tip_updated_at" timestamp,
	"base" integer,
	"tax" integer,
	"discount_total" integer,
	"total" integer,
	"settled_at" timestamp,
	"settled_by_member_id" text,
	"reopened_at" timestamp,
	"reopened_by_member_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bill_tipAmount_check" CHECK ("tip_amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "buyer" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"document_type" "buyer_document_type" NOT NULL,
	"document_number" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"consent" boolean NOT NULL,
	"consent_at" timestamp NOT NULL,
	"created_by_member_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "buyer_org_document_unique" UNIQUE("organization_id","document_type","document_number"),
	CONSTRAINT "buyer_consent_check" CHECK ("consent" = true)
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"bill_id" text NOT NULL,
	"tender" "payment_tender" NOT NULL,
	"amount" integer NOT NULL,
	"tendered" integer,
	"reference" text,
	"registered_offline" boolean DEFAULT false NOT NULL,
	"recorded_by_member_id" text,
	"client_recorded_at" timestamp,
	"recorded_at" timestamp NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_org_idempotencyKey_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "payment_amount_check" CHECK ("amount" >= 1),
	CONSTRAINT "payment_tendered_check" CHECK ("tendered" IS NULL OR "tendered" >= "amount"),
	CONSTRAINT "payment_cashTendered_check" CHECK ("tender" = 'cash' OR "tendered" IS NULL),
	CONSTRAINT "payment_reference_check" CHECK ("tender" = 'cash' OR length(trim(coalesce("reference", ''))) > 0)
);
--> statement-breakpoint
CREATE INDEX "bill_organizationId_idx" ON "bill" ("organization_id");--> statement-breakpoint
CREATE INDEX "bill_locationId_idx" ON "bill" ("location_id");--> statement-breakpoint
CREATE INDEX "buyer_organizationId_name_idx" ON "buyer" ("organization_id","name");--> statement-breakpoint
CREATE INDEX "payment_billId_idx" ON "payment" ("bill_id");--> statement-breakpoint
CREATE INDEX "payment_locationId_recordedAt_idx" ON "payment" ("location_id","recorded_at");--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_table_session_id_table_session_id_fkey" FOREIGN KEY ("table_session_id") REFERENCES "table_session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_tip_updated_by_member_id_member_id_fkey" FOREIGN KEY ("tip_updated_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_settled_by_member_id_member_id_fkey" FOREIGN KEY ("settled_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "bill" ADD CONSTRAINT "bill_reopened_by_member_id_member_id_fkey" FOREIGN KEY ("reopened_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "buyer" ADD CONSTRAINT "buyer_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "buyer" ADD CONSTRAINT "buyer_created_by_member_id_member_id_fkey" FOREIGN KEY ("created_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_bill_id_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bill"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_recorded_by_member_id_member_id_fkey" FOREIGN KEY ("recorded_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL;