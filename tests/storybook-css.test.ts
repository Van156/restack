import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Proves Tailwind scans story files: `StoryOnlyClass` in `button.stories.tsx` uses
 * `tracking-[0.37em]`, a class used nowhere else, so it only exists in the built CSS
 * when `@source` covers stories. Needs `pnpm build-storybook` first; Storybook is never
 * run from `bun test`, so the check is skipped when the build is absent.
 */
const assetsDir = join(import.meta.dir, "..", "packages", "ui", "storybook-static", "assets");
const built = existsSync(assetsDir);

if (!built) {
  console.warn(
    "storybook-css: SKIPPED — packages/ui/storybook-static is missing; run `pnpm build-storybook` first.",
  );
}

describe("storybook built CSS", () => {
  test.skipIf(!built)("contains the story-only class from button.stories.tsx", () => {
    const css = readdirSync(assetsDir)
      .filter((file) => file.endsWith(".css"))
      .map((file) => readFileSync(join(assetsDir, file), "utf8"))
      .join("\n");
    expect(css).toContain(".tracking-\\[0\\.37em\\]");
  });
});
