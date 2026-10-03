import * as schema from "@base-template/db/schema";

import type { RestaurantHarness, RestaurantSeed } from "./restaurant-fixtures";

/** A small service setup for order tests: a room, Stations, routed and unrouted Menu items. */
export type ServiceSeed = {
  areaId: string;
  /** Tables of Location A: `t1`, `t2`, `t3`, and `b1` in Location B. */
  tables: { t1: string; t2: string; t3: string; b1: string };
  areaBId: string;
  stations: { kitchen: string; bar: string };
  items: {
    /** 20 000 COP, routed to the kitchen, with a required "Término" group and an optional "Extra" group. */
    burger: string;
    /** 6 000 COP, routed to the bar. */
    beer: string;
    /** 9 000 COP, routed to the kitchen. */
    fries: string;
    /** Active but without a Station at Location A. */
    unrouted: string;
    /** Inactive Menu item routed to the bar. */
    retired: string;
  };
  modifiers: { medium: string; wellDone: string; cheese: string };
};

/** Inserts the service setup with plain inserts (the setup procedures have their own tests). */
export async function seedService(
  harness: RestaurantHarness,
  seed: RestaurantSeed,
): Promise<ServiceSeed> {
  const { db } = harness;
  const organizationId = seed.organizationId;
  const [area] = await db
    .insert(schema.area)
    .values({ organizationId, locationId: seed.locations.a, name: "Salón" })
    .returning();
  const [areaB] = await db
    .insert(schema.area)
    .values({ organizationId, locationId: seed.locations.b, name: "Salón B" })
    .returning();
  const tableRows = await db
    .insert(schema.diningTable)
    .values([
      { organizationId, locationId: seed.locations.a, areaId: area!.id, name: "M1", seats: 4 },
      { organizationId, locationId: seed.locations.a, areaId: area!.id, name: "M2", seats: 4 },
      { organizationId, locationId: seed.locations.a, areaId: area!.id, name: "M3", seats: 2 },
      { organizationId, locationId: seed.locations.b, areaId: areaB!.id, name: "B1", seats: 2 },
    ])
    .returning();
  const [kitchen, bar] = await db
    .insert(schema.station)
    .values([
      { organizationId, locationId: seed.locations.a, name: "Cocina" },
      { organizationId, locationId: seed.locations.a, name: "Barra" },
    ])
    .returning();
  const [category] = await db
    .insert(schema.menuCategory)
    .values({ organizationId, name: "Carta" })
    .returning();
  const itemRows = await db
    .insert(schema.menuItem)
    .values([
      { organizationId, categoryId: category!.id, name: "Hamburguesa", price: 20_000 },
      { organizationId, categoryId: category!.id, name: "Cerveza", price: 6_000 },
      { organizationId, categoryId: category!.id, name: "Papas", price: 9_000 },
      { organizationId, categoryId: category!.id, name: "Sin cocina", price: 5_000 },
      { organizationId, categoryId: category!.id, name: "Retirado", price: 4_000, active: false },
    ])
    .returning();
  const [burger, beer, fries, unrouted, retired] = itemRows as [
    (typeof itemRows)[number],
    (typeof itemRows)[number],
    (typeof itemRows)[number],
    (typeof itemRows)[number],
    (typeof itemRows)[number],
  ];
  await db.insert(schema.stationRouting).values([
    { organizationId, locationId: seed.locations.a, menuItemId: burger.id, stationId: kitchen!.id },
    { organizationId, locationId: seed.locations.a, menuItemId: fries.id, stationId: kitchen!.id },
    { organizationId, locationId: seed.locations.a, menuItemId: beer.id, stationId: bar!.id },
    { organizationId, locationId: seed.locations.a, menuItemId: retired.id, stationId: bar!.id },
  ]);
  const [doneness, extras] = await db
    .insert(schema.modifierGroup)
    .values([
      { organizationId, menuItemId: burger.id, name: "Término", minSelect: 1, maxSelect: 1 },
      { organizationId, menuItemId: burger.id, name: "Extra", minSelect: 0, maxSelect: 2 },
    ])
    .returning();
  const [medium, wellDone, cheese] = await db
    .insert(schema.modifier)
    .values([
      { organizationId, groupId: doneness!.id, name: "Medio", priceDelta: 0 },
      { organizationId, groupId: doneness!.id, name: "Bien cocido", priceDelta: 0 },
      { organizationId, groupId: extras!.id, name: "Queso", priceDelta: 2_000 },
    ])
    .returning();
  const table = (name: string) => tableRows.find((row) => row.name === name)!.id;
  return {
    areaId: area!.id,
    areaBId: areaB!.id,
    tables: { t1: table("M1"), t2: table("M2"), t3: table("M3"), b1: table("B1") },
    stations: { kitchen: kitchen!.id, bar: bar!.id },
    items: {
      burger: burger.id,
      beer: beer.id,
      fries: fries.id,
      unrouted: unrouted.id,
      retired: retired.id,
    },
    modifiers: { medium: medium!.id, wellDone: wellDone!.id, cheese: cheese!.id },
  };
}
