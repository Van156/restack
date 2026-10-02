import { describe, expect, test } from "bun:test";

import { initialNavParentState, nextNavParentState, toggleNavParent } from "./nav-parent-state";

describe("nav parent open state", () => {
  test("starts open only when a child is active", () => {
    expect(initialNavParentState(true).open).toBe(true);
    expect(initialNavParentState(false).open).toBe(false);
  });

  test("opens when a child becomes active after mount", () => {
    const next = nextNavParentState(initialNavParentState(false), true);
    expect(next.open).toBe(true);
  });

  test("keeps the user's toggle while the active state is unchanged", () => {
    const closed = toggleNavParent(initialNavParentState(true), false);
    expect(nextNavParentState(closed, true)).toBe(closed);
    expect(closed.open).toBe(false);
  });

  test("does not close when the section becomes inactive", () => {
    const next = nextNavParentState(initialNavParentState(true), false);
    expect(next.open).toBe(true);
    expect(next.wasActive).toBe(false);
  });

  test("re-entering the section re-opens a parent the user closed", () => {
    let state = toggleNavParent(initialNavParentState(true), false);
    state = nextNavParentState(state, false);
    expect(nextNavParentState(state, true).open).toBe(true);
  });

  test("returns the same reference when nothing changes", () => {
    const state = initialNavParentState(false);
    expect(nextNavParentState(state, false)).toBe(state);
  });
});
