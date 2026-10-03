import { describe, expect, test } from "bun:test";

import {
  emptyMenuItemForm,
  menuItemToForm,
  validateMenuItemForm,
  type MenuItemFormValues,
} from "./menu-item-form";

const valid: MenuItemFormValues = {
  ...emptyMenuItemForm("cat1"),
  name: " Bandeja paisa ",
  price: "32000",
  cost: "12000",
};

describe("validateMenuItemForm", () => {
  test("trims the name and parses price and cost as whole pesos", () => {
    expect(validateMenuItemForm(valid)).toEqual({
      ok: true,
      value: {
        categoryId: "cat1",
        name: "Bandeja paisa",
        price: 32000,
        taxClass: "impoconsumo",
        cost: 12000,
        active: true,
        modifierGroups: [],
      },
    });
  });

  test("an empty cost means no cost recorded", () => {
    const result = validateMenuItemForm({ ...valid, cost: "" });
    expect(result.ok && result.value.cost).toBeNull();
  });

  test("requires a name, a category and a valid price", () => {
    const result = validateMenuItemForm({ ...valid, name: "", categoryId: "", price: "12.5" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["categoryId", "name", "price"]);
    }
  });

  test("rejects a negative cost", () => {
    const result = validateMenuItemForm({ ...valid, cost: "-5" });
    expect(!result.ok && result.errors.cost).toBeDefined();
  });

  test("validates modifier groups: selection bounds and at least one modifier", () => {
    const group = {
      name: "Término",
      minSelect: "1",
      maxSelect: "1",
      modifiers: [
        { name: "Medio", priceDelta: "0" },
        { name: "Bien cocido", priceDelta: "-500" },
      ],
    };
    const ok = validateMenuItemForm({ ...valid, modifierGroups: [group] });
    expect(ok.ok && ok.value.modifierGroups).toEqual([
      {
        name: "Término",
        minSelect: 1,
        maxSelect: 1,
        modifiers: [
          { name: "Medio", priceDelta: 0 },
          { name: "Bien cocido", priceDelta: -500 },
        ],
      },
    ]);

    for (const bad of [
      { ...group, minSelect: "2", maxSelect: "1" },
      { ...group, minSelect: "3", maxSelect: "3" },
      { ...group, maxSelect: "0" },
      { ...group, name: " " },
      { ...group, modifiers: [] },
      { ...group, modifiers: [{ name: "", priceDelta: "0" }] },
      { ...group, modifiers: [{ name: "X", priceDelta: "1.5" }] },
    ]) {
      const result = validateMenuItemForm({ ...valid, modifierGroups: [bad] });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.modifierGroups).toBeDefined();
      }
    }
  });
});

describe("menuItemToForm", () => {
  test("round-trips an existing item into editable text fields", () => {
    const item = {
      id: "i1",
      categoryId: "cat1",
      name: "Jugo",
      price: 8000,
      taxClass: "iva19" as const,
      cost: null,
      active: false,
      modifierGroups: [
        {
          id: "g1",
          name: "Tamaño",
          minSelect: 0,
          maxSelect: 1,
          modifiers: [{ id: "m1", name: "Grande", priceDelta: 2000 }],
        },
      ],
    };
    const form = menuItemToForm(item);
    expect(form).toEqual({
      categoryId: "cat1",
      name: "Jugo",
      price: "8000",
      taxClass: "iva19",
      cost: "",
      active: false,
      modifierGroups: [
        {
          name: "Tamaño",
          minSelect: "0",
          maxSelect: "1",
          modifiers: [{ name: "Grande", priceDelta: "2000" }],
        },
      ],
    });
  });
});
