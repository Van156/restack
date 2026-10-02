import { describe, expect, test } from "bun:test";

import { formatRoleLabel } from "./role-label";

describe("formatRoleLabel", () => {
  test("returns a single role as is", () => {
    expect(formatRoleLabel("owner")).toBe("owner");
  });

  test("normalizes comma-separated roles with whitespace", () => {
    expect(formatRoleLabel("admin,  member ,owner")).toBe("admin, member, owner");
  });

  test("returns undefined when there is no role", () => {
    expect(formatRoleLabel(undefined)).toBeUndefined();
    expect(formatRoleLabel(null)).toBeUndefined();
    expect(formatRoleLabel("")).toBeUndefined();
    expect(formatRoleLabel(" , ")).toBeUndefined();
  });
});
