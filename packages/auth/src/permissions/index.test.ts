import { describe, expect, test } from "bun:test";

import * as permissions from "./index";

describe("permissions barrel", () => {
  test("re-exports the org catalog, platform catalog, and helpers", () => {
    expect(permissions.orgAc).toBeDefined();
    expect(permissions.orgRoles).toBeDefined();
    expect(permissions.platformAc).toBeDefined();
    expect(permissions.platformRoles).toBeDefined();
    expect(permissions.listCatalogPermissions()).toContain("project:read");
    expect(permissions.isBuiltInOrgRole("owner")).toBe(true);
  });
});
