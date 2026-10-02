import { describe, expect, test } from "bun:test";

import { reconcileExternalSearch } from "./search-sync";

describe("reconcileExternalSearch", () => {
  test("keeps the pending value when the search is what this table committed", () => {
    expect(reconcileExternalSearch({ searchKey: "A", committedKey: "A" })).toEqual({
      committedKey: "A",
      external: false,
    });
  });

  test("a search that differs from the last commit is external (back/forward, a link)", () => {
    expect(reconcileExternalSearch({ searchKey: "B", committedKey: "A" })).toEqual({
      committedKey: "B",
      external: true,
    });
  });

  test("the echo of this table's own commit is not external", () => {
    // the commit recorded key "C"; the router then delivers a search with key "C"
    expect(reconcileExternalSearch({ searchKey: "C", committedKey: "C" }).external).toBe(false);
  });

  test("back navigation after a commit is external and becomes the new baseline", () => {
    const afterBack = reconcileExternalSearch({ searchKey: "A", committedKey: "C" });
    expect(afterBack).toEqual({ committedKey: "A", external: true });
    expect(
      reconcileExternalSearch({ searchKey: "A", committedKey: afterBack.committedKey }),
    ).toEqual({ committedKey: "A", external: false });
  });
});
