import { describe, expect, test } from "bun:test";

import { describedBy, firstErrorMessage, uniqueErrorMessages } from "./form-errors";

describe("uniqueErrorMessages", () => {
  test("reads strings and { message } objects", () => {
    expect(uniqueErrorMessages(["Required", { message: "Too short" }])).toEqual([
      "Required",
      "Too short",
    ]);
  });

  test("dedupes across strings and objects, keeping first-seen order", () => {
    expect(
      uniqueErrorMessages(["Too short", { message: "Too short" }, { message: "Bad" }, "Bad"]),
    ).toEqual(["Too short", "Bad"]);
  });

  test("ignores undefined, null, empty, blank and message-less entries", () => {
    expect(
      uniqueErrorMessages([undefined, null, "", "  ", {}, { message: "" }, { message: 4 }, 42]),
    ).toEqual([]);
  });

  test("returns an empty list for no errors", () => {
    expect(uniqueErrorMessages([])).toEqual([]);
    expect(uniqueErrorMessages(undefined)).toEqual([]);
  });
});

describe("firstErrorMessage", () => {
  test("returns the first message", () => {
    expect(firstErrorMessage([undefined, { message: "First" }, "Second"])).toBe("First");
  });

  test("returns undefined when there is no usable message", () => {
    expect(firstErrorMessage([undefined, ""])).toBeUndefined();
    expect(firstErrorMessage(undefined)).toBeUndefined();
  });
});

describe("describedBy", () => {
  test("joins present ids with a space and skips falsy ones", () => {
    expect(describedBy("desc", undefined, "err")).toBe("desc err");
    expect(describedBy(false, "err")).toBe("err");
  });

  test("returns undefined when there is nothing to describe", () => {
    expect(describedBy(undefined, false)).toBeUndefined();
    expect(describedBy()).toBeUndefined();
  });
});
