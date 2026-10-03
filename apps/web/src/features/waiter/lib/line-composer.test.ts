import { describe, expect, test } from "bun:test";

import { composerTotal, groupErrors, toggleModifier, type ComposerItem } from "./line-composer";

const item: ComposerItem = {
  price: 18_000,
  modifierGroups: [
    {
      id: "g1",
      name: "Punto",
      minSelect: 1,
      maxSelect: 1,
      modifiers: [
        { id: "m1", name: "Medio", priceDelta: 0 },
        { id: "m2", name: "Bien cocido", priceDelta: 0 },
      ],
    },
    {
      id: "g2",
      name: "Extras",
      minSelect: 0,
      maxSelect: 2,
      modifiers: [
        { id: "m3", name: "Queso", priceDelta: 3_000 },
        { id: "m4", name: "Tocineta", priceDelta: 4_000 },
        { id: "m5", name: "Huevo", priceDelta: 2_000 },
      ],
    },
  ],
};

describe("toggleModifier", () => {
  test("a single-choice group swaps its selection", () => {
    expect(toggleModifier(item, ["m1"], "m2")).toEqual(["m2"]);
  });

  test("a multi-choice group adds and removes", () => {
    expect(toggleModifier(item, ["m1"], "m3")).toEqual(["m1", "m3"]);
    expect(toggleModifier(item, ["m1", "m3"], "m3")).toEqual(["m1"]);
  });

  test("a multi-choice group refuses a choice past its maximum", () => {
    expect(toggleModifier(item, ["m3", "m4"], "m5")).toEqual(["m3", "m4"]);
  });
});

describe("groupErrors", () => {
  test("names the group that is under its minimum", () => {
    expect(groupErrors(item, [])).toEqual({ g1: "Elige al menos 1 en «Punto»." });
  });

  test("is empty once every group is satisfied", () => {
    expect(groupErrors(item, ["m1"])).toEqual({});
  });
});

describe("composerTotal", () => {
  test("multiplies the unit price plus the chosen deltas by the quantity", () => {
    expect(composerTotal(item, ["m1", "m3", "m4"], 2)).toBe(2 * (18_000 + 3_000 + 4_000));
  });
});
