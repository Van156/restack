import { describe, expect, test } from "bun:test";

import { reconcileSelectionKey } from "./selection";

describe("reconcileSelectionKey", () => {
  test("does not reset the first time it sees a key", () => {
    expect(reconcileSelectionKey({ previousKey: undefined, key: "a" })).toEqual({
      key: "a",
      reset: false,
    });
  });

  test("does not reset while the key is unchanged", () => {
    expect(reconcileSelectionKey({ previousKey: "a", key: "a" })).toEqual({
      key: "a",
      reset: false,
    });
  });

  test("resets when the query (page, sort, filters) changes", () => {
    expect(reconcileSelectionKey({ previousKey: "page 1", key: "page 2" })).toEqual({
      key: "page 2",
      reset: true,
    });
  });
});
