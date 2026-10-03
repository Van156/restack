CREATE TYPE "dian_document_kind" AS ENUM('pos_equivalent', 'factura');--> statement-breakpoint
CREATE TYPE "dian_document_status" AS ENUM('pending', 'issued', 'rejected');--> statement-breakpoint
CREATE TYPE "dian_habilitacion_status" AS ENUM('not_started', 'in_progress', 'enabled');--> statement-breakpoint
CREATE TYPE "dian_provider" AS ENUM('alegra');--> statement-breakpoint
CREATE TABLE "dian_connection" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL CONSTRAINT "dianConnection_location_unique" UNIQUE,
	"provider" "dian_provider" NOT NULL,
	"company_reference" text NOT NULL,
	"numbering_prefix" text,
	"habilitacion" "dian_habilitacion_status" DEFAULT 'not_started'::"dian_habilitacion_status" NOT NULL,
	"connected_by_user_id" text,
	"connected_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dian_document" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"bill_id" text NOT NULL,
	"kind" "dian_document_kind" NOT NULL,
	"status" "dian_document_status" DEFAULT 'pending'::"dian_document_status" NOT NULL,
	"buyer_document_type" "buyer_document_type",
	"buyer_document_number" text,
	"buyer_name" text,
	"number" text,
	"provider_reference" text,
	"cude" text,
	"qr_data" text,
	"rejection_reason" text,
	"sale_time" timestamp NOT NULL,
	"contingency" boolean DEFAULT false NOT NULL,
	"payload" jsonb NOT NULL,
	"submissions" integer DEFAULT 0 NOT NULL,
	"issued_at" timestamp,
	"created_by_user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dianDocument_bill_kind_unique" UNIQUE("bill_id","kind")
);
--> statement-breakpoint
CREATE TABLE "dian_document_counter" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"month" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "dianDocumentCounter_location_month_unique" UNIQUE("location_id","month"),
	CONSTRAINT "dianDocumentCounter_count_check" CHECK ("count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "dian_incident" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"cause" text NOT NULL,
	"started_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"documents_covered" integer DEFAULT 0 NOT NULL,
	"reported" boolean DEFAULT false NOT NULL,
	CONSTRAINT "dianIncident_documentsCovered_check" CHECK ("documents_covered" >= 0)
);
--> statement-breakpoint
CREATE TABLE "dian_outbox" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"document_id" text NOT NULL CONSTRAINT "dianOutbox_document_unique" UNIQUE,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp NOT NULL,
	"transmit_by" timestamp NOT NULL,
	"overdue_at" timestamp,
	"last_error" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "dianDocument_locationId_saleTime_idx" ON "dian_document" ("location_id","sale_time");--> statement-breakpoint
CREATE UNIQUE INDEX "dianIncident_open_unique" ON "dian_incident" ("location_id") WHERE "ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "dianIncident_locationId_startedAt_idx" ON "dian_incident" ("location_id","started_at");--> statement-breakpoint
CREATE INDEX "dianOutbox_pending_idx" ON "dian_outbox" ("completed_at","next_attempt_at");--> statement-breakpoint
CREATE INDEX "dianOutbox_locationId_idx" ON "dian_outbox" ("location_id");--> statement-breakpoint
ALTER TABLE "dian_connection" ADD CONSTRAINT "dian_connection_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dian_connection" ADD CONSTRAINT "dian_connection_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dian_connection" ADD CONSTRAINT "dian_connection_connected_by_user_id_user_id_fkey" FOREIGN KEY ("connected_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "dian_document" ADD CONSTRAINT "dian_document_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dian_document" ADD CONSTRAINT "dian_document_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dian_document" ADD CONSTRAINT "dian_document_bill_id_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "bill"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dian_document" ADD CONSTRAINT "dian_document_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "dian_document_counter" ADD CONSTRAINT "dian_document_counter_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dian_document_counter" ADD CONSTRAINT "dian_document_counter_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dian_incident" ADD CONSTRAINT "dian_incident_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dian_incident" ADD CONSTRAINT "dian_incident_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dian_outbox" ADD CONSTRAINT "dian_outbox_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dian_outbox" ADD CONSTRAINT "dian_outbox_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dian_outbox" ADD CONSTRAINT "dian_outbox_document_id_dian_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "dian_document"("id") ON DELETE CASCADE;