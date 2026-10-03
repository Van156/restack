import { defineRelationsPart, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { organization } from "./auth";
import { location } from "./restaurant";

/** Where a Station's Tickets appear. `printer` is reserved and rejected by the API ("Later"). */
export const stationOutput = pgEnum("station_output", ["kitchen_display", "printer"]);

/** Tax class of a Menu item: impoconsumo 8% inclusive, or IVA 19% for franchise Locations. */
export const menuTaxClass = pgEnum("menu_tax_class", ["impoconsumo", "iva19"]);

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const organizationId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

const locationId = () =>
  text("location_id")
    .notNull()
    .references(() => location.id, { onDelete: "cascade" });

const createdAt = () => timestamp("created_at").defaultNow().notNull();

/** A zone of a Location (dining room, terrace). Unique per Location by name. */
export const area = pgTable(
  "area",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: locationId(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("area_location_name_unique").on(table.locationId, table.name),
    index("area_organizationId_idx").on(table.organizationId),
  ],
);

/** A physical table of a Location, inside an Area. Unique per Location by name. */
export const diningTable = pgTable(
  "dining_table",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: locationId(),
    areaId: text("area_id")
      .notNull()
      .references(() => area.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    seats: integer("seats").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("diningTable_location_name_unique").on(table.locationId, table.name),
    index("diningTable_organizationId_idx").on(table.organizationId),
    index("diningTable_areaId_idx").on(table.areaId),
    check("diningTable_seats_check", sql`${table.seats} >= 1`),
  ],
);

/** A preparation point of a Location (hot kitchen, bar) that receives Tickets. */
export const station = pgTable(
  "station",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: locationId(),
    name: text("name").notNull(),
    output: stationOutput("output").default("kitchen_display").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    unique("station_location_name_unique").on(table.locationId, table.name),
    index("station_organizationId_idx").on(table.organizationId),
  ],
);

/** Restaurant-wide Menu category. */
export const menuCategory = pgTable(
  "menu_category",
  {
    id: id(),
    organizationId: organizationId(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: createdAt(),
  },
  (table) => [unique("menuCategory_org_name_unique").on(table.organizationId, table.name)],
);

/** Restaurant-wide Menu item. Prices are integer COP and include the tax of the item's class. */
export const menuItem = pgTable(
  "menu_item",
  {
    id: id(),
    organizationId: organizationId(),
    categoryId: text("category_id")
      .notNull()
      .references(() => menuCategory.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    price: integer("price").notNull(),
    taxClass: menuTaxClass("tax_class").default("impoconsumo").notNull(),
    cost: integer("cost"),
    active: boolean("active").default(true).notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("menuItem_category_name_unique").on(table.categoryId, table.name),
    index("menuItem_organizationId_idx").on(table.organizationId),
    check("menuItem_price_check", sql`${table.price} >= 0`),
    check("menuItem_cost_check", sql`${table.cost} IS NULL OR ${table.cost} >= 0`),
  ],
);

/** Sold-out flag of a Menu item at one Location. No row means available. */
export const menuItemAvailability = pgTable(
  "menu_item_availability",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: locationId(),
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItem.id, { onDelete: "cascade" }),
    soldOut: boolean("sold_out").default(false).notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("menuItemAvailability_location_item_unique").on(table.locationId, table.menuItemId),
    index("menuItemAvailability_organizationId_idx").on(table.organizationId),
  ],
);

/** A choice group of a Menu item (for example "Término"), with selection limits. */
export const modifierGroup = pgTable(
  "modifier_group",
  {
    id: id(),
    organizationId: organizationId(),
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItem.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    minSelect: integer("min_select").default(0).notNull(),
    maxSelect: integer("max_select").default(1).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("modifierGroup_menuItemId_idx").on(table.menuItemId),
    index("modifierGroup_organizationId_idx").on(table.organizationId),
    check(
      "modifierGroup_select_check",
      sql`${table.minSelect} >= 0 AND ${table.maxSelect} >= 1 AND ${table.minSelect} <= ${table.maxSelect}`,
    ),
  ],
);

/** An option inside a modifier group. The price delta is integer COP and may be zero or negative. */
export const modifier = pgTable(
  "modifier",
  {
    id: id(),
    organizationId: organizationId(),
    groupId: text("group_id")
      .notNull()
      .references(() => modifierGroup.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceDelta: integer("price_delta").default(0).notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("modifier_groupId_idx").on(table.groupId),
    index("modifier_organizationId_idx").on(table.organizationId),
  ],
);

/** Which Station prepares a Menu item at a Location. One routing per Location and Menu item. */
export const stationRouting = pgTable(
  "station_routing",
  {
    id: id(),
    organizationId: organizationId(),
    locationId: locationId(),
    menuItemId: text("menu_item_id")
      .notNull()
      .references(() => menuItem.id, { onDelete: "cascade" }),
    stationId: text("station_id")
      .notNull()
      .references(() => station.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
  },
  (table) => [
    unique("stationRouting_location_item_unique").on(table.locationId, table.menuItemId),
    index("stationRouting_organizationId_idx").on(table.organizationId),
    index("stationRouting_stationId_idx").on(table.stationId),
  ],
);

export const restaurantSetupRelations = defineRelationsPart(
  {
    location,
    area,
    diningTable,
    station,
    menuCategory,
    menuItem,
    menuItemAvailability,
    modifierGroup,
    modifier,
    stationRouting,
  },
  (r) => ({
    area: {
      location: r.one.location({ from: r.area.locationId, to: r.location.id }),
      tables: r.many.diningTable({ from: r.area.id, to: r.diningTable.areaId }),
    },
    diningTable: {
      area: r.one.area({ from: r.diningTable.areaId, to: r.area.id }),
    },
    station: {
      location: r.one.location({ from: r.station.locationId, to: r.location.id }),
      routings: r.many.stationRouting({ from: r.station.id, to: r.stationRouting.stationId }),
    },
    menuCategory: {
      items: r.many.menuItem({ from: r.menuCategory.id, to: r.menuItem.categoryId }),
    },
    menuItem: {
      category: r.one.menuCategory({ from: r.menuItem.categoryId, to: r.menuCategory.id }),
      modifierGroups: r.many.modifierGroup({ from: r.menuItem.id, to: r.modifierGroup.menuItemId }),
      availability: r.many.menuItemAvailability({
        from: r.menuItem.id,
        to: r.menuItemAvailability.menuItemId,
      }),
      routings: r.many.stationRouting({ from: r.menuItem.id, to: r.stationRouting.menuItemId }),
    },
    modifierGroup: {
      menuItem: r.one.menuItem({ from: r.modifierGroup.menuItemId, to: r.menuItem.id }),
      modifiers: r.many.modifier({ from: r.modifierGroup.id, to: r.modifier.groupId }),
    },
    modifier: {
      group: r.one.modifierGroup({ from: r.modifier.groupId, to: r.modifierGroup.id }),
    },
    stationRouting: {
      station: r.one.station({ from: r.stationRouting.stationId, to: r.station.id }),
      menuItem: r.one.menuItem({ from: r.stationRouting.menuItemId, to: r.menuItem.id }),
    },
  }),
);
