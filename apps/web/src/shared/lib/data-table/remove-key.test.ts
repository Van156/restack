import { describe, expect, test } from "bun:test";

import { isRemoveKey, removeRowOnKey } from "./remove-key";

function keyEvent(key: string, { onRow = true }: { onRow?: boolean } = {}) {
  const row = new EventTarget();
  let prevented = false;
  return {
    key,
    target: onRow ? row : new EventTarget(),
    currentTarget: row,
    preventDefault: () => {
      prevented = true;
    },
    get prevented() {
      return prevented;
    },
  };
}

describe("isRemoveKey", () => {
  test("accepts Delete and Backspace in any case", () => {
    expect(isRemoveKey("Delete")).toBe(true);
    expect(isRemoveKey("Backspace")).toBe(true);
    expect(isRemoveKey("delete")).toBe(true);
  });

  test("rejects other keys", () => {
    expect(isRemoveKey("Enter")).toBe(false);
    expect(isRemoveKey("a")).toBe(false);
  });
});

describe("removeRowOnKey", () => {
  test("removes the row and prevents the default on Delete or Backspace", () => {
    let removed = 0;
    for (const key of ["Delete", "Backspace"]) {
      const event = keyEvent(key);
      removeRowOnKey(event, { blocked: false, onRemove: () => (removed += 1) });
      expect(event.prevented).toBe(true);
    }
    expect(removed).toBe(2);
  });

  test("ignores keys that are not remove keys", () => {
    let removed = 0;
    const event = keyEvent("Enter");
    removeRowOnKey(event, { blocked: false, onRemove: () => (removed += 1) });
    expect(removed).toBe(0);
    expect(event.prevented).toBe(false);
  });

  test("ignores keys pressed inside a control of the row", () => {
    let removed = 0;
    const event = keyEvent("Delete", { onRow: false });
    removeRowOnKey(event, { blocked: false, onRemove: () => (removed += 1) });
    expect(removed).toBe(0);
    expect(event.prevented).toBe(false);
  });

  test("ignores keys while a popup of the row is open", () => {
    let removed = 0;
    const event = keyEvent("Delete");
    removeRowOnKey(event, { blocked: true, onRemove: () => (removed += 1) });
    expect(removed).toBe(0);
    expect(event.prevented).toBe(false);
  });
});
