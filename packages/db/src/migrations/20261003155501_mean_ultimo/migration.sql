CREATE TABLE "sync_superseded_write" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "syncSupersededWrite_org_idempotencyKey_unique" UNIQUE("organization_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "table_session_key" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"table_session_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tableSessionKey_org_idempotencyKey_unique" UNIQUE("organization_id","idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "table_session" ADD COLUMN "table_moved_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "table_session" ADD COLUMN "table_move_key" text;--> statement-breakpoint
CREATE INDEX "tableSessionKey_tableSessionId_idx" ON "table_session_key" ("table_session_id");--> statement-breakpoint
ALTER TABLE "sync_superseded_write" ADD CONSTRAINT "sync_superseded_write_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "table_session_key" ADD CONSTRAINT "table_session_key_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "table_session_key" ADD CONSTRAINT "table_session_key_table_session_id_table_session_id_fkey" FOREIGN KEY ("table_session_id") REFERENCES "table_session"("id") ON DELETE CASCADE;