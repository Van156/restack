CREATE TYPE "discount_kind" AS ENUM('amount', 'percent');--> statement-breakpoint
CREATE TYPE "table_session_status" AS ENUM('open', 'bill_requested', 'settled');--> statement-breakpoint
CREATE TYPE "ticket_status" AS ENUM('nuevo', 'preparando', 'listo', 'entregado');--> statement-breakpoint
CREATE TABLE "discount" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"table_session_id" text NOT NULL,
	"kind" "discount_kind" NOT NULL,
	"value" integer NOT NULL,
	"override_id" text,
	"approver_member_id" text,
	"recorded_by_member_id" text,
	"recorded_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discount_value_check" CHECK ("value" >= 1 AND ("kind" <> 'percent' OR "value" <= 100))
);
--> statement-breakpoint
CREATE TABLE "order_line" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"table_session_id" text NOT NULL,
	"menu_item_id" text,
	"item_name" text NOT NULL,
	"unit_price" integer NOT NULL,
	"tax_class" "menu_tax_class" NOT NULL,
	"modifiers" jsonb DEFAULT '[]' NOT NULL,
	"quantity" integer NOT NULL,
	"note" text,
	"recorded_by_member_id" text,
	"client_recorded_at" timestamp,
	"recorded_at" timestamp NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orderLine_org_idempotencyKey_unique" UNIQUE("organization_id","idempotency_key"),
	CONSTRAINT "orderLine_quantity_check" CHECK ("quantity" >= 1),
	CONSTRAINT "orderLine_unitPrice_check" CHECK ("unit_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "order_line_void" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"order_line_id" text NOT NULL CONSTRAINT "orderLineVoid_orderLine_unique" UNIQUE,
	"reason" text,
	"override_id" text,
	"recorded_by_member_id" text,
	"recorded_at" timestamp NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orderLineVoid_org_idempotencyKey_unique" UNIQUE("organization_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "table_session" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"table_id" text NOT NULL,
	"status" "table_session_status" DEFAULT 'open'::"table_session_status" NOT NULL,
	"opened_by_member_id" text,
	"opened_at" timestamp NOT NULL,
	"settled_at" timestamp,
	"token_version" integer DEFAULT 1 NOT NULL,
	"short_code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"table_session_id" text NOT NULL,
	"station_id" text NOT NULL,
	"status" "ticket_status" DEFAULT 'nuevo'::"ticket_status" NOT NULL,
	"sent_by_member_id" text,
	"sent_at" timestamp NOT NULL,
	"started_at" timestamp,
	"ready_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_line" (
	"ticket_id" text NOT NULL,
	"order_line_id" text NOT NULL CONSTRAINT "ticketLine_orderLine_unique" UNIQUE
);
--> statement-breakpoint
CREATE INDEX "discount_tableSessionId_idx" ON "discount" ("table_session_id");--> statement-breakpoint
CREATE INDEX "orderLine_tableSessionId_idx" ON "order_line" ("table_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tableSession_open_table_unique" ON "table_session" ("table_id") WHERE "status" <> 'settled';--> statement-breakpoint
CREATE INDEX "tableSession_organizationId_idx" ON "table_session" ("organization_id");--> statement-breakpoint
CREATE INDEX "tableSession_locationId_idx" ON "table_session" ("location_id");--> statement-breakpoint
CREATE INDEX "ticket_tableSessionId_idx" ON "ticket" ("table_session_id");--> statement-breakpoint
CREATE INDEX "ticket_station_status_idx" ON "ticket" ("station_id","status");--> statement-breakpoint
CREATE INDEX "ticket_organizationId_idx" ON "ticket" ("organization_id");--> statement-breakpoint
CREATE INDEX "ticketLine_ticketId_idx" ON "ticket_line" ("ticket_id");--> statement-breakpoint
ALTER TABLE "discount" ADD CONSTRAINT "discount_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "discount" ADD CONSTRAINT "discount_table_session_id_table_session_id_fkey" FOREIGN KEY ("table_session_id") REFERENCES "table_session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "discount" ADD CONSTRAINT "discount_override_id_override_id_fkey" FOREIGN KEY ("override_id") REFERENCES "override"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "discount" ADD CONSTRAINT "discount_approver_member_id_member_id_fkey" FOREIGN KEY ("approver_member_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "discount" ADD CONSTRAINT "discount_recorded_by_member_id_member_id_fkey" FOREIGN KEY ("recorded_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_table_session_id_table_session_id_fkey" FOREIGN KEY ("table_session_id") REFERENCES "table_session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_menu_item_id_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_recorded_by_member_id_member_id_fkey" FOREIGN KEY ("recorded_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "order_line_void" ADD CONSTRAINT "order_line_void_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_line_void" ADD CONSTRAINT "order_line_void_order_line_id_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_line"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "order_line_void" ADD CONSTRAINT "order_line_void_override_id_override_id_fkey" FOREIGN KEY ("override_id") REFERENCES "override"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "order_line_void" ADD CONSTRAINT "order_line_void_recorded_by_member_id_member_id_fkey" FOREIGN KEY ("recorded_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "table_session" ADD CONSTRAINT "table_session_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "table_session" ADD CONSTRAINT "table_session_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "table_session" ADD CONSTRAINT "table_session_table_id_dining_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "dining_table"("id");--> statement-breakpoint
ALTER TABLE "table_session" ADD CONSTRAINT "table_session_opened_by_member_id_member_id_fkey" FOREIGN KEY ("opened_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_table_session_id_table_session_id_fkey" FOREIGN KEY ("table_session_id") REFERENCES "table_session"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_station_id_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "station"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_sent_by_member_id_member_id_fkey" FOREIGN KEY ("sent_by_member_id") REFERENCES "member"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "ticket_line" ADD CONSTRAINT "ticket_line_ticket_id_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "ticket"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "ticket_line" ADD CONSTRAINT "ticket_line_order_line_id_order_line_id_fkey" FOREIGN KEY ("order_line_id") REFERENCES "order_line"("id") ON DELETE CASCADE;