import { describe, expect, test } from "bun:test";

import { menuRowsByCategory, taxClassLabel } from "./menu-rows";

const categories = [
  { id: "c1", name: "Platos" },
  { id: "c2", name: "Bebidas" },
];
const items = [
  { id: "i1", categoryId: "c1", name: "Bandeja" },
  { id: "i2", categoryId: "c1", name: "Sancocho" },
  { id: "i3", categoryId: "c2", name: "Jugo" },
];
const locationMenu = [
  {
    id: "c1",
    items: [
      { id: "i1", soldOut: true, station: { id: "s1", name: "Cocina" } },
      { id: "i2", soldOut: false, station: null },
    ],
  },
  { id: "c2", items: [{ id: "i3", soldOut: false, station: { id: "s2", name: "Bar" } }] },
];

describe("menuRowsByCategory", () => {
  test("joins each item with its sold-out flag and Station at the Location", () => {
    const groups = menuRowsByCategory(categories, items, locationMenu);
    expect(groups.map((group) => group.category.name)).toEqual(["Platos", "Bebidas"]);
    expect(groups[0]?.rows.map((row) => [row.item.name, row.soldOut, row.stationId])).toEqual([
      ["Bandeja", true, "s1"],
      ["Sancocho", false, null],
    ]);
    expect(groups[1]?.rows[0]).toMatchObject({ soldOut: false, stationId: "s2" });
  });

  test("keeps categories without items so they can still be renamed or deleted", () => {
    const groups = menuRowsByCategory(
      [...categories, { id: "c3", name: "Postres" }],
      items,
      locationMenu,
    );
    expect(groups[2]).toMatchObject({ category: { name: "Postres" }, rows: [] });
  });

  test("an item the Location view does not know is available and unrouted", () => {
    const groups = menuRowsByCategory(categories, items, []);
    expect(groups[0]?.rows[0]).toMatchObject({ soldOut: false, stationId: null });
  });
});

describe("taxClassLabel", () => {
  test("names both tax classes", () => {
    expect(taxClassLabel("impoconsumo")).toBe("Impoconsumo 8 %");
    expect(taxClassLabel("iva19")).toBe("IVA 19 %");
  });
});
