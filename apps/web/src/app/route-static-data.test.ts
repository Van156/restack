import { describe, expect, test } from "bun:test";

import { matchesUseAppShell } from "./route-static-data";

describe("matchesUseAppShell", () => {
  test("is true when any active match opted in", () => {
    expect(
      matchesUseAppShell([
        { staticData: {} },
        { staticData: { appShell: true } },
        { staticData: {} },
      ]),
    ).toBe(true);
  });

  test("is false when no match opted in (onboarding, public routes)", () => {
    expect(matchesUseAppShell([{ staticData: {} }, { staticData: { appShell: false } }])).toBe(
      false,
    );
  });

  test("is false with no matches", () => {
    expect(matchesUseAppShell([])).toBe(false);
  });
});
