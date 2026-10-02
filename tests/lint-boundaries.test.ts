import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Proves the import-boundary rules in `.oxlintrc.json` (spec §4.6) actually
 * fire. oxlint matches `overrides[].files` relative to the config file, so the
 * committed fixtures (which mirror `apps/web/src/...` and `packages/ui/...`)
 * are copied next to a copy of the repo config in a temp dir and linted there.
 * The real tree never sees them: `ignorePatterns` skips the fixtures folder.
 */
const repoRoot = join(import.meta.dir, "..");
const fixturesRoot = join(import.meta.dir, "lint-boundaries", "fixtures");

let workDir = "";
let reports: Map<string, string[]>;

type OxlintJson = {
  diagnostics: { code: string; message: string; help?: string; filename: string }[];
};

beforeAll(() => {
  workDir = mkdtempSync(join(tmpdir(), "lint-boundaries-"));
  cpSync(fixturesRoot, workDir, { recursive: true });

  const config = JSON.parse(readFileSync(join(repoRoot, ".oxlintrc.json"), "utf8"));
  // The fixtures folder is ignored in the real tree; the copy has no such path.
  delete config.ignorePatterns;
  writeFileSync(join(workDir, ".oxlintrc.json"), JSON.stringify(config));

  const oxlint = join(repoRoot, "node_modules", ".bin", "oxlint");
  const result = spawnSync(oxlint, ["-c", ".oxlintrc.json", "--format", "json", "."], {
    cwd: workDir,
    encoding: "utf8",
  });
  // oxlint exits 1 when it reports diagnostics (expected here) and 0 when clean;
  // anything else (spawn failure, signal, config error) must fail loudly with its stderr.
  if (result.error || (result.status !== 0 && result.status !== 1)) {
    throw new Error(
      `oxlint did not run cleanly (status ${result.status}, signal ${result.signal}): ` +
        `${result.error?.message ?? ""}\n${result.stderr}`,
    );
  }
  let parsed: OxlintJson;
  try {
    parsed = JSON.parse(result.stdout) as OxlintJson;
  } catch (error) {
    throw new Error(`oxlint output was not JSON: ${String(error)}\n${result.stderr}`);
  }

  reports = new Map();
  for (const diagnostic of parsed.diagnostics) {
    if (!diagnostic.code.includes("no-restricted-imports")) continue;
    const messages = reports.get(diagnostic.filename) ?? [];
    messages.push(diagnostic.help ?? diagnostic.message);
    reports.set(diagnostic.filename, messages);
  }
});

afterAll(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

describe("import boundary lint rules", () => {
  test("reports a routes file deep-importing a feature internal", () => {
    const messages = reports.get("apps/web/src/routes/deep-import.ts") ?? [];
    expect(messages.join("\n")).toContain("public API");
  });

  test("reports a shared/ file importing a feature", () => {
    const messages = reports.get("apps/web/src/shared/components/imports-feature.ts") ?? [];
    expect(messages.join("\n")).toContain("shared/ must not depend on features/ or routes/");
  });

  test("reports a packages/ui file importing an app alias", () => {
    const messages = reports.get("packages/ui/src/imports-app.ts") ?? [];
    expect(messages.join("\n")).toContain("packages/ui must stay app-agnostic");
  });

  test("does not report a relative import inside a feature", () => {
    expect(reports.get("apps/web/src/features/x/components/widget.ts")).toBeUndefined();
  });

  test("does not report a feature's public API import from routes", () => {
    expect(reports.get("apps/web/src/routes/public-api.ts")).toBeUndefined();
  });
});
