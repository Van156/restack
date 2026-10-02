import { describe, expect, test } from "bun:test";

import {
  assertCatalogPermissions,
  BUILT_IN_ORG_ROLES,
  InvalidPermissionFormatError,
  isBuiltInOrgRole,
  isCatalogPermission,
  listCatalogPermissions,
  parsePermissionString,
  permissionsObjectToStrings,
  permissionStringsToObject,
  UnknownCatalogPermissionError,
} from "./helpers";

describe("parsePermissionString", () => {
  test("splits a valid feature:action string", () => {
    expect(parsePermissionString("project:create")).toEqual({
      feature: "project",
      action: "create",
    });
  });

  test("throws InvalidPermissionFormatError when there is no colon", () => {
    expect(() => parsePermissionString("project")).toThrow(InvalidPermissionFormatError);
  });

  test("throws InvalidPermissionFormatError when a part is empty", () => {
    expect(() => parsePermissionString("project:")).toThrow(InvalidPermissionFormatError);
    expect(() => parsePermissionString(":create")).toThrow(InvalidPermissionFormatError);
  });

  test("throws InvalidPermissionFormatError when there are extra colons", () => {
    expect(() => parsePermissionString("a:b:c")).toThrow(InvalidPermissionFormatError);
  });
});

describe("permissionStringsToObject", () => {
  test("groups strings by feature, deduped, in stable sorted order", () => {
    const result = permissionStringsToObject([
      "project:update",
      "project:create",
      "project:create",
      "audit:read",
    ]);
    expect(result).toEqual({
      audit: ["read"],
      project: ["create", "update"],
    });
    expect(Object.keys(result)).toEqual(["audit", "project"]);
  });

  test("throws on a malformed entry", () => {
    expect(() => permissionStringsToObject(["project:create", "bad"])).toThrow(
      InvalidPermissionFormatError,
    );
  });
});

describe("permissionsObjectToStrings", () => {
  test("flattens the object shape into sorted, deduped feature:action strings", () => {
    expect(
      permissionsObjectToStrings({
        project: ["update", "create", "create"],
        audit: ["read"],
      }),
    ).toEqual(["audit:read", "project:create", "project:update"]);
  });
});

describe("listCatalogPermissions / isCatalogPermission", () => {
  test("lists every feature:action pair in the org catalog", () => {
    const permissions = listCatalogPermissions();
    expect(permissions).toContain("audit:read");
    expect(permissions).toContain("project:create");
    expect(permissions).toContain("organization:delete");
  });

  test("accepts catalog permissions", () => {
    expect(isCatalogPermission("audit:read")).toBe(true);
    expect(isCatalogPermission("project:delete")).toBe(true);
  });

  test("rejects permissions outside the catalog, without throwing", () => {
    expect(isCatalogPermission("invoice:create")).toBe(false);
    expect(isCatalogPermission("not-a-permission")).toBe(false);
  });

  test("excludes team permissions (teams are out of scope for v1)", () => {
    expect(listCatalogPermissions().some((permission) => permission.startsWith("team:"))).toBe(
      false,
    );
    expect(isCatalogPermission("team:create")).toBe(false);
  });
});

describe("assertCatalogPermissions", () => {
  test("passes silently when every permission is in the catalog", () => {
    expect(() => assertCatalogPermissions(["audit:read", "project:create"])).not.toThrow();
  });

  test("throws UnknownCatalogPermissionError listing every unknown permission", () => {
    expect(() =>
      assertCatalogPermissions(["audit:read", "invoice:create", "billing:read"]),
    ).toThrow(UnknownCatalogPermissionError);
    try {
      assertCatalogPermissions(["audit:read", "invoice:create", "billing:read"]);
      throw new Error("expected assertCatalogPermissions to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(UnknownCatalogPermissionError);
      expect((error as UnknownCatalogPermissionError).values).toEqual([
        "invoice:create",
        "billing:read",
      ]);
    }
  });
});

describe("BUILT_IN_ORG_ROLES / isBuiltInOrgRole", () => {
  test("lists owner, admin, member", () => {
    expect(BUILT_IN_ORG_ROLES).toEqual(["owner", "admin", "member"]);
  });

  test("identifies built-in role names", () => {
    expect(isBuiltInOrgRole("owner")).toBe(true);
    expect(isBuiltInOrgRole("admin")).toBe(true);
    expect(isBuiltInOrgRole("member")).toBe(true);
    expect(isBuiltInOrgRole("billing-manager")).toBe(false);
  });
});
