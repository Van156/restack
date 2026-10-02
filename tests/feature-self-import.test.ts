import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * A feature must import its own modules relatively (spec §4.6). Importing its
 * own public API (`@/features/<name>`) from inside creates an import cycle
 * through the barrel. oxlint globs cannot express "the feature I am in", so
 * this scans every feature folder instead.
 */
const repoRoot = join(import.meta.dir, "..");
const featuresRoot = join(repoRoot, "apps", "web", "src", "features");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

/** Module specifiers of `import`/`export ... from` and dynamic `import()`. */
export function moduleSpecifiers(source: string): string[] {
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+)["']/g;
  return [...source.matchAll(pattern)].map((match) => match[1] as string);
}

export function importsOwnFeature(specifier: string, feature: string): boolean {
  const base = `@/features/${feature}`;
  return specifier === base || specifier.startsWith(`${base}/`);
}

describe("moduleSpecifiers / importsOwnFeature", () => {
  test("detects exact and subpath self imports only", () => {
    const source = [
      `import { a } from "@/features/auth";`,
      `import b from '@/features/auth/lib/x';`,
      `export { c } from "@/features/authx";`,
      `const d = await import("@/features/auth");`,
      `import "@/features/auth";`,
    ].join("\n");
    const own = moduleSpecifiers(source).filter((s) => importsOwnFeature(s, "auth"));
    expect(own).toEqual([
      "@/features/auth",
      "@/features/auth/lib/x",
      "@/features/auth",
      "@/features/auth",
    ]);
  });
});

describe("features never import their own barrel", () => {
  const features = readdirSync(featuresRoot).filter((name) =>
    statSync(join(featuresRoot, name)).isDirectory(),
  );

  test("there is at least one feature to scan", () => {
    expect(features.length).toBeGreaterThan(0);
  });

  for (const feature of features) {
    test(`features/${feature} uses relative imports internally`, () => {
      const offenders = sourceFiles(join(featuresRoot, feature)).filter((file) =>
        moduleSpecifiers(readFileSync(file, "utf8")).some((s) => importsOwnFeature(s, feature)),
      );
      expect(offenders.map((file) => relative(repoRoot, file))).toEqual([]);
    });
  }
});
