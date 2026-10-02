import { describe, expect, test } from "bun:test";

import { dateRangeToFilterValue, formatFilterDate, parseTimestamp } from "./date";

describe("parseTimestamp", () => {
  test("reads a numeric timestamp or its string form", () => {
    expect(parseTimestamp(1700000000000)?.getTime()).toBe(1700000000000);
    expect(parseTimestamp("1700000000000")?.getTime()).toBe(1700000000000);
  });

  test("rejects blanks and garbage", () => {
    expect(parseTimestamp("")).toBeUndefined();
    expect(parseTimestamp(undefined)).toBeUndefined();
    expect(parseTimestamp("abc")).toBeUndefined();
    expect(parseTimestamp(0)).toBeUndefined();
  });
});

describe("dateRangeToFilterValue", () => {
  test("is a [from, to] pair of timestamps, an open end is undefined", () => {
    const from = new Date(1700000000000);
    const to = new Date(1700086400000);
    expect(dateRangeToFilterValue({ from, to })).toEqual([1700000000000, 1700086400000]);
    expect(dateRangeToFilterValue({ from })).toEqual([1700000000000, undefined]);
  });

  test("an empty range clears the filter", () => {
    expect(dateRangeToFilterValue({})).toBeUndefined();
    expect(dateRangeToFilterValue(undefined)).toBeUndefined();
  });
});

describe("formatFilterDate", () => {
  test("formats a date as month, day and year", () => {
    expect(formatFilterDate(new Date(2024, 0, 5))).toBe("Jan 05, 2024");
  });

  test("returns an empty string for an unset date", () => {
    expect(formatFilterDate(undefined)).toBe("");
  });
});
