import { describe, expect, test } from "bun:test";

import { toThemePreference } from "./theme-options";

describe("toThemePreference", () => {
  test("passes known themes through", () => {
    expect(toThemePreference("light")).toBe("light");
    expect(toThemePreference("dark")).toBe("dark");
    expect(toThemePreference("system")).toBe("system");
  });

  test("falls back to system for unset or unknown values", () => {
    expect(toThemePreference(undefined)).toBe("system");
    expect(toThemePreference("solarized")).toBe("system");
  });
});
