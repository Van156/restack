import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { APP_PRESENTATIONAL_COMPONENTS } from "./lib/app-story-registry";
import {
  findAppComponentsWithoutStories,
  findUiComponentsWithoutStories,
} from "./lib/story-coverage";

describe("findUiComponentsWithoutStories", () => {
  test("returns nothing when every component has a story", () => {
    expect(
      findUiComponentsWithoutStories([
        "button.tsx",
        "button.stories.tsx",
        "card.tsx",
        "card.stories.tsx",
      ]),
    ).toEqual([]);
  });

  test("names each component without a sibling story, sorted", () => {
    expect(
      findUiComponentsWithoutStories(["card.tsx", "button.tsx", "button.stories.tsx", "alert.tsx"]),
    ).toEqual(["alert", "card"]);
  });

  test("ignores test and story files as components", () => {
    expect(
      findUiComponentsWithoutStories([
        "slider.tsx",
        "slider.stories.tsx",
        "slider.test.tsx",
        "x.test.tsx",
      ]),
    ).toEqual([]);
  });

  test("keeps hyphens in names (file names, not story ids)", () => {
    expect(
      findUiComponentsWithoutStories([
        "input-otp.tsx",
        "input-otp.stories.tsx",
        "alert-dialog.tsx",
      ]),
    ).toEqual(["alert-dialog"]);
  });

  test("ignores non-tsx files", () => {
    expect(findUiComponentsWithoutStories(["README.md", "utils.ts"])).toEqual([]);
  });
});

describe("packages/ui primitives", () => {
  test("every component has a sibling <name>.stories.tsx", () => {
    const dir = join(import.meta.dir, "..", "packages", "ui", "src", "components");
    const missing = findUiComponentsWithoutStories(readdirSync(dir));
    expect(
      missing,
      `Components without a story (add <name>.stories.tsx): ${missing.join(", ")}`,
    ).toEqual([]);
  });
});

describe("findAppComponentsWithoutStories", () => {
  test("names registered components with no sibling story, sorted", () => {
    const files = new Set(["a/x.tsx", "a/x.stories.tsx", "a/y.tsx", "a/b.tsx"]);
    expect(
      findAppComponentsWithoutStories(["a/y.tsx", "a/x.tsx", "a/b.tsx"], (f) => files.has(f)),
    ).toEqual(["a/b.tsx", "a/y.tsx"]);
  });

  test("names registered components whose file no longer exists", () => {
    expect(findAppComponentsWithoutStories(["a/gone.tsx"], () => false)).toEqual(["a/gone.tsx"]);
  });
});

describe("findAppComponentsWithoutStories (invalid entries)", () => {
  test("rejects registry entries that are not plain .tsx components", () => {
    expect(findAppComponentsWithoutStories(["a/x.ts", "a/y.stories.tsx"], () => true)).toEqual([
      "a/x.ts",
      "a/y.stories.tsx",
    ]);
  });
});

describe("apps/web presentational components", () => {
  test("every registered component has a sibling <name>.stories.tsx", () => {
    const root = join(import.meta.dir, "..", "apps", "web", "src");
    const missing = findAppComponentsWithoutStories(APP_PRESENTATIONAL_COMPONENTS, (file) =>
      existsSync(join(root, file)),
    );
    expect(
      missing,
      `Registered app components without a story or file (add <name>.stories.tsx or fix tests/lib/app-story-registry.ts): ${missing.join(", ")}`,
    ).toEqual([]);
  });
});
