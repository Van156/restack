import { describe, expect, test } from "bun:test";

import { getFacetedValues, isFacetedSelected, toggleFacetedValue } from "./faceted-utils";

describe("toggleFacetedValue (multiple)", () => {
  test("adds a value that is not selected", () => {
    expect(toggleFacetedValue({ multiple: true, current: ["a"], selected: "b" })).toEqual([
      "a",
      "b",
    ]);
  });

  test("removes a value that is selected", () => {
    expect(toggleFacetedValue({ multiple: true, current: ["a", "b"], selected: "a" })).toEqual([
      "b",
    ]);
  });

  test("starts from an empty list when nothing is selected", () => {
    expect(toggleFacetedValue({ multiple: true, current: undefined, selected: "a" })).toEqual([
      "a",
    ]);
    expect(toggleFacetedValue({ multiple: true, current: "", selected: "a" })).toEqual(["a"]);
  });

  test("removing the last value gives an empty list, not undefined", () => {
    expect(toggleFacetedValue({ multiple: true, current: ["a"], selected: "a" })).toEqual([]);
  });

  test("does not mutate the current list", () => {
    const current = ["a"];
    toggleFacetedValue({ multiple: true, current, selected: "b" });
    expect(current).toEqual(["a"]);
  });
});

describe("toggleFacetedValue (single)", () => {
  test("selects a value", () => {
    expect(toggleFacetedValue({ multiple: false, current: undefined, selected: "a" })).toBe("a");
    expect(toggleFacetedValue({ multiple: false, current: "b", selected: "a" })).toBe("a");
  });

  test("selecting the current value clears the selection", () => {
    expect(toggleFacetedValue({ multiple: false, current: "a", selected: "a" })).toBeUndefined();
  });
});

describe("isFacetedSelected", () => {
  test("multiple checks list membership", () => {
    expect(isFacetedSelected({ multiple: true, current: ["a", "b"], value: "b" })).toBe(true);
    expect(isFacetedSelected({ multiple: true, current: ["a"], value: "b" })).toBe(false);
    expect(isFacetedSelected({ multiple: true, current: undefined, value: "b" })).toBe(false);
  });

  test("single compares equality", () => {
    expect(isFacetedSelected({ multiple: false, current: "a", value: "a" })).toBe(true);
    expect(isFacetedSelected({ multiple: false, current: "a", value: "b" })).toBe(false);
    expect(isFacetedSelected({ multiple: false, current: "", value: "a" })).toBe(false);
  });
});

describe("getFacetedValues", () => {
  test("normalizes every value shape to a list", () => {
    expect(getFacetedValues(["a", "b"])).toEqual(["a", "b"]);
    expect(getFacetedValues("a")).toEqual(["a"]);
    expect(getFacetedValues("")).toEqual([]);
    expect(getFacetedValues(undefined)).toEqual([]);
  });
});
