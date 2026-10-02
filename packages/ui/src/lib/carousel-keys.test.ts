import { describe, expect, test } from "bun:test";

import { getCarouselKeyAction, isEditableTarget } from "./carousel-keys";

describe("getCarouselKeyAction", () => {
  test("horizontal uses ArrowLeft/ArrowRight", () => {
    expect(getCarouselKeyAction("ArrowLeft", "horizontal", false)).toBe("prev");
    expect(getCarouselKeyAction("ArrowRight", "horizontal", false)).toBe("next");
  });

  test("horizontal ignores ArrowUp/ArrowDown", () => {
    expect(getCarouselKeyAction("ArrowUp", "horizontal", false)).toBeNull();
    expect(getCarouselKeyAction("ArrowDown", "horizontal", false)).toBeNull();
  });

  test("vertical uses ArrowUp/ArrowDown", () => {
    expect(getCarouselKeyAction("ArrowUp", "vertical", false)).toBe("prev");
    expect(getCarouselKeyAction("ArrowDown", "vertical", false)).toBe("next");
  });

  test("vertical ignores ArrowLeft/ArrowRight", () => {
    expect(getCarouselKeyAction("ArrowLeft", "vertical", false)).toBeNull();
    expect(getCarouselKeyAction("ArrowRight", "vertical", false)).toBeNull();
  });

  test("ignores non-arrow keys", () => {
    expect(getCarouselKeyAction("a", "horizontal", false)).toBeNull();
    expect(getCarouselKeyAction("Enter", "vertical", false)).toBeNull();
  });

  test("does not intercept arrows from editable targets", () => {
    expect(getCarouselKeyAction("ArrowLeft", "horizontal", true)).toBeNull();
    expect(getCarouselKeyAction("ArrowDown", "vertical", true)).toBeNull();
  });
});

describe("isEditableTarget", () => {
  test("detects input, textarea and select", () => {
    expect(isEditableTarget({ tagName: "INPUT" })).toBe(true);
    expect(isEditableTarget({ tagName: "TEXTAREA" })).toBe(true);
    expect(isEditableTarget({ tagName: "SELECT" })).toBe(true);
  });

  test("detects contenteditable elements", () => {
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: true })).toBe(true);
  });

  test("treats other elements and null as not editable", () => {
    expect(isEditableTarget({ tagName: "DIV", isContentEditable: false })).toBe(false);
    expect(isEditableTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe("isEditableTarget with arrow-owning widgets", () => {
  const roles = [
    "slider",
    "spinbutton",
    "radiogroup",
    "radio",
    "listbox",
    "option",
    "combobox",
    "menu",
    "menuitem",
    "menubar",
    "tablist",
    "tab",
    "grid",
    "tree",
  ];

  // Minimal stand-in for an element nested inside a widget with the given role.
  const insideRole = (role: string) => ({
    tagName: "SPAN",
    closest: (selector: string) => (selector.includes(`[role="${role}"]`) ? {} : null),
  });

  for (const role of roles) {
    test(`skips targets inside role="${role}"`, () => {
      expect(isEditableTarget(insideRole(role))).toBe(true);
    });
  }

  test("does not skip targets outside any arrow-owning widget", () => {
    expect(isEditableTarget({ tagName: "DIV", closest: () => null })).toBe(false);
  });
});
