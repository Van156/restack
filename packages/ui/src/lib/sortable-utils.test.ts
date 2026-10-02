import { describe, expect, test } from "bun:test";

import {
  getSortableAnnouncementIndex,
  isActivatorEventIgnored,
  moveSortableItem,
} from "./sortable-utils";

describe("isActivatorEventIgnored", () => {
  test("does not ignore an unhandled pointer event", () => {
    expect(isActivatorEventIgnored({ type: "mousedown", defaultPrevented: false })).toBe(false);
  });

  test("ignores a pointer event a child already handled with preventDefault", () => {
    expect(isActivatorEventIgnored({ type: "mousedown", defaultPrevented: true })).toBe(true);
    expect(isActivatorEventIgnored({ type: "touchstart", defaultPrevented: true })).toBe(true);
  });

  test("never ignores a keyboard activation: KeyboardSensor always calls preventDefault", () => {
    expect(isActivatorEventIgnored({ type: "keydown", defaultPrevented: true })).toBe(false);
    expect(isActivatorEventIgnored({ type: "keydown", defaultPrevented: false })).toBe(false);
  });

  test("a missing activator event is not ignored", () => {
    expect(isActivatorEventIgnored(null)).toBe(false);
    expect(isActivatorEventIgnored(undefined)).toBe(false);
  });
});

describe("moveSortableItem", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const getValue = (item: { id: string }) => item.id;

  test("moves the active item to the position of the over item", () => {
    const result = moveSortableItem({ items, getValue, activeId: "a", overId: "c" });
    expect(result?.activeIndex).toBe(0);
    expect(result?.overIndex).toBe(2);
    expect(result?.items.map(getValue)).toEqual(["b", "c", "a", "d"]);
  });

  test("moves an item up", () => {
    const result = moveSortableItem({ items, getValue, activeId: "d", overId: "b" });
    expect(result?.items.map(getValue)).toEqual(["a", "d", "b", "c"]);
  });

  test("does not mutate the input", () => {
    moveSortableItem({ items, getValue, activeId: "a", overId: "d" });
    expect(items.map(getValue)).toEqual(["a", "b", "c", "d"]);
  });

  test("returns null when the active item is gone (findIndex is -1)", () => {
    expect(moveSortableItem({ items, getValue, activeId: "zzz", overId: "c" })).toBeNull();
  });

  test("returns null when the over item is unknown", () => {
    expect(moveSortableItem({ items, getValue, activeId: "a", overId: "zzz" })).toBeNull();
  });

  test("returns null when dropped on itself", () => {
    expect(moveSortableItem({ items, getValue, activeId: "b", overId: "b" })).toBeNull();
  });

  test("works with primitive items", () => {
    const result = moveSortableItem({
      items: ["x", "y", "z"],
      getValue: (item) => item,
      activeId: "z",
      overId: "x",
    });
    expect(result?.items).toEqual(["z", "x", "y"]);
  });
});

describe("getSortableAnnouncementIndex", () => {
  test("reads the dnd-kit sortable index", () => {
    expect(getSortableAnnouncementIndex({ sortable: { index: 2 } })).toBe(2);
  });

  test("falls back to 0 instead of NaN when there is no sortable data", () => {
    expect(getSortableAnnouncementIndex(undefined)).toBe(0);
    expect(getSortableAnnouncementIndex({})).toBe(0);
    expect(getSortableAnnouncementIndex({ sortable: {} })).toBe(0);
    expect(getSortableAnnouncementIndex({ sortable: { index: "x" } })).toBe(0);
  });
});
