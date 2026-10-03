CREATE TYPE "menu_tax_class" AS ENUM('impoconsumo', 'iva19');--> statement-breakpoint
CREATE TYPE "station_output" AS ENUM('kitchen_display', 'printer');--> statement-breakpoint
CREATE TABLE "area" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "area_location_name_unique" UNIQUE("location_id","name")
);
--> statement-breakpoint
CREATE TABLE "dining_table" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"area_id" text NOT NULL,
	"name" text NOT NULL,
	"seats" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "diningTable_location_name_unique" UNIQUE("location_id","name"),
	CONSTRAINT "diningTable_seats_check" CHECK ("seats" >= 1)
);
--> statement-breakpoint
CREATE TABLE "menu_category" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "menuCategory_org_name_unique" UNIQUE("organization_id","name")
);
--> statement-breakpoint
CREATE TABLE "menu_item" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"category_id" text NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"tax_class" "menu_tax_class" DEFAULT 'impoconsumo'::"menu_tax_class" NOT NULL,
	"cost" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "menuItem_category_name_unique" UNIQUE("category_id","name"),
	CONSTRAINT "menuItem_price_check" CHECK ("price" >= 0),
	CONSTRAINT "menuItem_cost_check" CHECK ("cost" IS NULL OR "cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "menu_item_availability" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"menu_item_id" text NOT NULL,
	"sold_out" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "menuItemAvailability_location_item_unique" UNIQUE("location_id","menu_item_id")
);
--> statement-breakpoint
CREATE TABLE "modifier" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"group_id" text NOT NULL,
	"name" text NOT NULL,
	"price_delta" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modifier_group" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"menu_item_id" text NOT NULL,
	"name" text NOT NULL,
	"min_select" integer DEFAULT 0 NOT NULL,
	"max_select" integer DEFAULT 1 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "modifierGroup_select_check" CHECK ("min_select" >= 0 AND "max_select" >= 1 AND "min_select" <= "max_select")
);
--> statement-breakpoint
CREATE TABLE "station" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"name" text NOT NULL,
	"output" "station_output" DEFAULT 'kitchen_display'::"station_output" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "station_location_name_unique" UNIQUE("location_id","name")
);
--> statement-breakpoint
CREATE TABLE "station_routing" (
	"id" text PRIMARY KEY,
	"organization_id" text NOT NULL,
	"location_id" text NOT NULL,
	"menu_item_id" text NOT NULL,
	"station_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stationRouting_location_item_unique" UNIQUE("location_id","menu_item_id")
);
--> statement-breakpoint
CREATE INDEX "area_organizationId_idx" ON "area" ("organization_id");--> statement-breakpoint
CREATE INDEX "diningTable_organizationId_idx" ON "dining_table" ("organization_id");--> statement-breakpoint
CREATE INDEX "diningTable_areaId_idx" ON "dining_table" ("area_id");--> statement-breakpoint
CREATE INDEX "menuItem_organizationId_idx" ON "menu_item" ("organization_id");--> statement-breakpoint
CREATE INDEX "menuItemAvailability_organizationId_idx" ON "menu_item_availability" ("organization_id");--> statement-breakpoint
CREATE INDEX "modifier_groupId_idx" ON "modifier" ("group_id");--> statement-breakpoint
CREATE INDEX "modifier_organizationId_idx" ON "modifier" ("organization_id");--> statement-breakpoint
CREATE INDEX "modifierGroup_menuItemId_idx" ON "modifier_group" ("menu_item_id");--> statement-breakpoint
CREATE INDEX "modifierGroup_organizationId_idx" ON "modifier_group" ("organization_id");--> statement-breakpoint
CREATE INDEX "station_organizationId_idx" ON "station" ("organization_id");--> statement-breakpoint
CREATE INDEX "stationRouting_organizationId_idx" ON "station_routing" ("organization_id");--> statement-breakpoint
CREATE INDEX "stationRouting_stationId_idx" ON "station_routing" ("station_id");--> statement-breakpoint
ALTER TABLE "area" ADD CONSTRAINT "area_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "area" ADD CONSTRAINT "area_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dining_table" ADD CONSTRAINT "dining_table_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dining_table" ADD CONSTRAINT "dining_table_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "dining_table" ADD CONSTRAINT "dining_table_area_id_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "area"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "menu_category" ADD CONSTRAINT "menu_category_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_category_id_menu_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "menu_category"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "menu_item_availability" ADD CONSTRAINT "menu_item_availability_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "menu_item_availability" ADD CONSTRAINT "menu_item_availability_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "menu_item_availability" ADD CONSTRAINT "menu_item_availability_menu_item_id_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "modifier" ADD CONSTRAINT "modifier_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "modifier" ADD CONSTRAINT "modifier_group_id_modifier_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "modifier_group"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "modifier_group" ADD CONSTRAINT "modifier_group_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "modifier_group" ADD CONSTRAINT "modifier_group_menu_item_id_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "station" ADD CONSTRAINT "station_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "station" ADD CONSTRAINT "station_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "station_routing" ADD CONSTRAINT "station_routing_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "station_routing" ADD CONSTRAINT "station_routing_location_id_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "location"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "station_routing" ADD CONSTRAINT "station_routing_menu_item_id_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_item"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "station_routing" ADD CONSTRAINT "station_routing_station_id_station_id_fkey" FOREIGN KEY ("station_id") REFERENCES "station"("id") ON DELETE RESTRICT;