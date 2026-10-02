import { describe, expect, test } from "bun:test";

import {
  DAY_MS,
  escapeLikePattern,
  MAX_EPOCH_MS,
  MIN_EPOCH_MS,
  parseEpochValue,
  parseNumberValue,
} from "./list-values";

describe("parseNumberValue", () => {
  test("accepts plain decimals", () => {
    expect(parseNumberValue("10")).toBe(10);
    expect(parseNumberValue("-3.5")).toBe(-3.5);
    expect(parseNumberValue("0.25")).toBe(0.25);
    expect(parseNumberValue(".5")).toBe(0.5);
    expect(parseNumberValue("5.")).toBe(5);
  });

  test("rejects non-decimal forms Number() would accept", () => {
    for (const text of ["0x10", "0b11", "0o7", "1e3", "1E3", "1e300", " 1", "1 ", "+1", "1_0"]) {
      expect(parseNumberValue(text)).toBeUndefined();
    }
  });

  test("rejects blanks, non-numbers and non-finite values", () => {
    for (const text of ["", " ", "abc", "Infinity", "NaN", "-", "."]) {
      expect(parseNumberValue(text)).toBeUndefined();
    }
  });

  test("rejects magnitudes beyond the safe integer range", () => {
    expect(parseNumberValue(String(Number.MAX_SAFE_INTEGER))).toBe(Number.MAX_SAFE_INTEGER);
    expect(parseNumberValue("9007199254740993")).toBeUndefined();
    expect(parseNumberValue(`1${"0".repeat(300)}`)).toBeUndefined();
  });

  test("integer mode rejects fractions", () => {
    expect(parseNumberValue("4", { integer: true })).toBe(4);
    expect(parseNumberValue("-4", { integer: true })).toBe(-4);
    expect(parseNumberValue("4.5", { integer: true })).toBeUndefined();
    expect(parseNumberValue("4.", { integer: true })).toBeUndefined();
  });
});

describe("parseEpochValue", () => {
  test("accepts integer epochs inside the bounds", () => {
    expect(parseEpochValue("1767225600000")).toBe(1_767_225_600_000);
    expect(parseEpochValue("-1")).toBe(-1);
    expect(parseEpochValue(String(MIN_EPOCH_MS))).toBe(MIN_EPOCH_MS);
    expect(parseEpochValue(String(MAX_EPOCH_MS))).toBe(MAX_EPOCH_MS);
  });

  test("rejects anything outside the bounds, so start + DAY_MS is always a valid Date", () => {
    expect(parseEpochValue(String(MAX_EPOCH_MS + 1))).toBeUndefined();
    expect(parseEpochValue(String(MIN_EPOCH_MS - 1))).toBeUndefined();
    expect(parseEpochValue("8640000000000000")).toBeUndefined();
    expect(parseEpochValue("99999999999999999999")).toBeUndefined();
    expect(Number.isNaN(new Date(MAX_EPOCH_MS + DAY_MS).getTime())).toBe(false);
    expect(new Date(MAX_EPOCH_MS + DAY_MS).toISOString()).toBe("9999-12-31T00:00:00.000Z");
    expect(new Date(MIN_EPOCH_MS).toISOString()).toBe("0001-01-01T00:00:00.000Z");
  });

  test("rejects fractions, signs and non-decimal forms", () => {
    for (const text of ["1.5", "1e3", "0x10", "+5", "", "yesterday", " 5"]) {
      expect(parseEpochValue(text)).toBeUndefined();
    }
  });
});

describe("escapeLikePattern", () => {
  test("escapes backslash, percent and underscore so text matches literally", () => {
    expect(escapeLikePattern("50%_off\\now")).toBe("50\\%\\_off\\\\now");
  });

  test("leaves other text alone", () => {
    expect(escapeLikePattern("plain text")).toBe("plain text");
  });
});
