import { describe, expect, test } from "bun:test";

import {
  commitRangeInput,
  getRangeBounds,
  normalizeBetweenRange,
  parseRangeValue,
  resolveRangeInput,
  resolveSliderCommit,
  setRangeInputDraft,
} from "./range";

describe("getRangeBounds", () => {
  test("uses meta.range and a step that gives about 20 to 50 stops", () => {
    expect(getRangeBounds([0, 10])).toEqual({ min: 0, max: 10, step: 1 });
    expect(getRangeBounds([0, 100])).toEqual({ min: 0, max: 100, step: 5 });
    expect(getRangeBounds([0, 1000])).toEqual({ min: 0, max: 1000, step: 20 });
  });

  test("defaults to 0..100 without a usable range", () => {
    expect(getRangeBounds(undefined)).toEqual({ min: 0, max: 100, step: 5 });
    expect(getRangeBounds([Number.NaN, 5])).toEqual({ min: 0, max: 100, step: 5 });
    expect(getRangeBounds([10, 5])).toEqual({ min: 0, max: 100, step: 5 });
  });
});

describe("parseRangeValue", () => {
  test("accepts a pair of numbers or numeric strings", () => {
    expect(parseRangeValue([1, 5])).toEqual([1, 5]);
    expect(parseRangeValue(["1", "5"])).toEqual([1, 5]);
  });

  test("rejects open ends, non-numbers and wrong lengths", () => {
    expect(parseRangeValue(["1", ""])).toBeUndefined();
    expect(parseRangeValue(["a", "5"])).toBeUndefined();
    expect(parseRangeValue([1])).toBeUndefined();
    expect(parseRangeValue("1,5")).toBeUndefined();
    expect(parseRangeValue(undefined)).toBeUndefined();
  });
});

describe("resolveRangeInput", () => {
  const bounds = { min: 0, max: 100 };

  test("commits a typed number for the lower end", () => {
    expect(resolveRangeInput({ raw: "40", index: 0, current: [25, 75], ...bounds })).toEqual([
      40, 75,
    ]);
  });

  test("a value typed in several keystrokes is accepted once complete (25 to 100)", () => {
    // The old handler rejected "1" and "10" while typing 100 because they were below `from`.
    expect(resolveRangeInput({ raw: "100", index: 1, current: [25, 75], ...bounds })).toEqual([
      25, 100,
    ]);
  });

  test("clamps the lower end to the minimum and to the upper end", () => {
    expect(resolveRangeInput({ raw: "-5", index: 0, current: [25, 75], ...bounds })).toEqual([
      0, 75,
    ]);
    expect(resolveRangeInput({ raw: "90", index: 0, current: [25, 75], ...bounds })).toEqual([
      75, 75,
    ]);
  });

  test("clamps the upper end to the maximum and to the lower end", () => {
    expect(resolveRangeInput({ raw: "500", index: 1, current: [25, 75], ...bounds })).toEqual([
      25, 100,
    ]);
    expect(resolveRangeInput({ raw: "10", index: 1, current: [25, 75], ...bounds })).toEqual([
      25, 25,
    ]);
  });

  test("a blank or non-numeric draft reverts (null)", () => {
    expect(resolveRangeInput({ raw: "", index: 0, current: [25, 75], ...bounds })).toBeNull();
    expect(resolveRangeInput({ raw: "  ", index: 1, current: [25, 75], ...bounds })).toBeNull();
    expect(resolveRangeInput({ raw: "abc", index: 1, current: [25, 75], ...bounds })).toBeNull();
    expect(
      resolveRangeInput({ raw: "Infinity", index: 1, current: [25, 75], ...bounds }),
    ).toBeNull();
  });
});

describe("normalizeBetweenRange", () => {
  test("clamps both ends to the bounds and orders them", () => {
    expect(normalizeBetweenRange(["90", "10"], { min: 0, max: 100 })).toEqual(["10", "90"]);
    expect(normalizeBetweenRange(["-5", "500"], { min: 0, max: 100 })).toEqual(["0", "100"]);
  });

  test("keeps an open or non-numeric end as typed", () => {
    expect(normalizeBetweenRange(["", "40"], { min: 0, max: 100 })).toEqual(["", "40"]);
    expect(normalizeBetweenRange(["x", "40"], { min: 0, max: 100 })).toEqual(["x", "40"]);
  });

  test("without bounds it only orders", () => {
    expect(normalizeBetweenRange(["9", "3"])).toEqual(["3", "9"]);
  });
});

describe("range input drafts", () => {
  const base = { min: 0, max: 100, current: [10, 90] as [number, number] };

  test("setRangeInputDraft replaces one draft and keeps the other", () => {
    expect(setRangeInputDraft([null, "5"], 0, "7")).toEqual(["7", "5"]);
    expect(setRangeInputDraft(["7", "5"], 1, null)).toEqual(["7", null]);
  });

  test("a commit clears the draft and returns the clamped range", () => {
    const result = commitRangeInput({ drafts: ["20", null], index: 0, ...base });
    expect(result.drafts).toEqual([null, null]);
    expect(result.next).toEqual([20, 90]);
  });

  test("Enter then blur commits once: the second commit finds no draft", () => {
    const enter = commitRangeInput({ drafts: ["20", null], index: 0, ...base });
    expect(enter.next).toEqual([20, 90]);
    const blur = commitRangeInput({ drafts: enter.drafts, index: 0, ...base });
    expect(blur.next).toBeNull();
    expect(blur.drafts).toEqual([null, null]);
  });

  test("an unchanged value does not write but still clears the draft", () => {
    const result = commitRangeInput({ drafts: ["10", null], index: 0, ...base });
    expect(result.next).toBeNull();
    expect(result.drafts).toEqual([null, null]);
  });

  test("a blank or non-numeric draft reverts without writing", () => {
    expect(commitRangeInput({ drafts: ["", null], index: 0, ...base }).next).toBeNull();
    expect(commitRangeInput({ drafts: [null, "abc"], index: 1, ...base })).toEqual({
      drafts: [null, null],
      next: null,
    });
  });

  test("committing one input leaves the other input's draft", () => {
    const result = commitRangeInput({ drafts: ["20", "80"], index: 0, ...base });
    expect(result.drafts).toEqual([null, "80"]);
  });
});

describe("resolveSliderCommit", () => {
  test("a released two-thumb value is written", () => {
    expect(resolveSliderCommit([20, 80])).toEqual([20, 80]);
  });

  test("a single value or an odd length is ignored", () => {
    expect(resolveSliderCommit(20)).toBeNull();
    expect(resolveSliderCommit([1, 2, 3])).toBeNull();
  });
});
