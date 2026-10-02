import { describe, expect, test } from "bun:test";

import { getSliderThumbCount } from "./slider-thumbs";

describe("getSliderThumbCount", () => {
  test("uses one thumb per entry of an array value", () => {
    expect(getSliderThumbCount([10, 90], undefined)).toBe(2);
    expect(getSliderThumbCount([10, 50, 90], undefined)).toBe(3);
  });

  test("uses one thumb per entry of an array defaultValue", () => {
    expect(getSliderThumbCount(undefined, [20, 80])).toBe(2);
  });

  test("prefers value over defaultValue", () => {
    expect(getSliderThumbCount([10], [20, 80])).toBe(1);
  });

  test("uses a single thumb for a scalar value or defaultValue", () => {
    expect(getSliderThumbCount(40, undefined)).toBe(1);
    expect(getSliderThumbCount(undefined, 40)).toBe(1);
  });

  test("uses a single thumb when no value is given", () => {
    expect(getSliderThumbCount(undefined, undefined)).toBe(1);
  });

  test("renders no thumbs for an empty array, as Base UI range mode does", () => {
    expect(getSliderThumbCount([], undefined)).toBe(0);
  });
});
