import { describe, expect, test } from "bun:test";

import {
  marginPercent,
  toItemRows,
  toStaffRows,
  toTotalsRow,
  type ItemSource,
  type MarginSource,
  type StaffSource,
} from "./margin-view";

const item = (over: Partial<ItemSource>): ItemSource => ({
  menuItemId: "m1",
  itemName: "Bandeja",
  quantity: 4,
  revenue: 80_000,
  cost: 32_000,
  margin: 48_000,
  costMissing: false,
  ...over,
});

describe("marginPercent", () => {
  test("is the margin over the costed revenue, rounded to a whole percent", () => {
    expect(marginPercent(48_000, 80_000)).toBe(60);
    expect(marginPercent(1, 3)).toBe(33);
  });

  test("is null without a margin or a base", () => {
    expect(marginPercent(null, 80_000)).toBeNull();
    expect(marginPercent(10, 0)).toBeNull();
  });
});

describe("toItemRows", () => {
  test("shows cost, margin and percent when the item has a cost", () => {
    expect(toItemRows([item({})])).toEqual([
      {
        key: "m1",
        name: "Bandeja",
        quantity: 4,
        revenue: 80_000,
        cost: 32_000,
        margin: 48_000,
        marginPercent: 60,
        costMissing: false,
      },
    ]);
  });

  test("flags an item without cost and never invents a zero cost or margin", () => {
    const [row] = toItemRows([item({ cost: null, margin: null, costMissing: true })]);
    expect(row).toMatchObject({ cost: null, margin: null, marginPercent: null, costMissing: true });
  });

  test("an item deleted from the Menu keeps its recorded name and a name-based key", () => {
    const [row] = toItemRows([item({ menuItemId: null, itemName: "Jugo" })]);
    expect(row?.key).toBe("name:Jugo");
  });
});

const margin = (over: Partial<MarginSource>): MarginSource => ({
  revenue: 100_000,
  costedRevenue: 80_000,
  uncostedRevenue: 20_000,
  cost: 30_000,
  margin: 50_000,
  marginIncomplete: true,
  ...over,
});

describe("toStaffRows", () => {
  const staff = (over: Partial<StaffSource>): StaffSource => ({
    memberId: "mem1",
    name: "Ana",
    billCount: 5,
    salesTotal: 100_000,
    tipTotal: 8_000,
    margin: margin({}),
    ...over,
  });

  test("carries sales, tips, cost, margin and the incomplete-margin flag", () => {
    expect(toStaffRows([staff({})])).toEqual([
      {
        key: "mem1",
        name: "Ana",
        billCount: 5,
        salesTotal: 100_000,
        tipTotal: 8_000,
        cost: 30_000,
        margin: 50_000,
        marginPercent: 63,
        marginIncomplete: true,
      },
    ]);
  });

  test("a Bill settled by nobody known reads as unassigned", () => {
    const [row] = toStaffRows([staff({ memberId: null, name: null })]);
    expect(row).toMatchObject({ key: "none", name: "Sin asignar" });
  });

  test("a member without a resolvable name keeps a neutral label", () => {
    const [row] = toStaffRows([staff({ name: null })]);
    expect(row?.name).toBe("Persona sin nombre");
  });

  test("no cost anywhere gives no margin", () => {
    const [row] = toStaffRows([
      staff({
        margin: margin({ costedRevenue: 0, cost: 0, margin: null, uncostedRevenue: 100_000 }),
      }),
    ]);
    expect(row).toMatchObject({ margin: null, marginPercent: null, marginIncomplete: true });
  });
});

describe("toTotalsRow", () => {
  test("summarizes the margin of the whole report", () => {
    expect(toTotalsRow(margin({}))).toEqual({
      revenue: 100_000,
      cost: 30_000,
      margin: 50_000,
      marginPercent: 63,
      marginIncomplete: true,
    });
  });
});
