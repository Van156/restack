import { describe, expect, test } from "bun:test";

import { resolveCallerAccess } from "./caller-access";
import { buildRoleCatalog } from "./role-catalog";

const catalog = buildRoleCatalog([{ role: "viewer", permission: { project: ["read"] } }]);

describe("resolveCallerAccess", () => {
  test("fails closed while the caller's role is unresolved", () => {
    expect(resolveCallerAccess(catalog, undefined)).toEqual({
      callerPermission: null,
      assignable: [],
    });
  });

  test("fails closed when no role name resolves", () => {
    expect(resolveCallerAccess(catalog, "ghost")).toEqual({
      callerPermission: null,
      assignable: [],
    });
  });

  test("an owner may assign every role in the catalog", () => {
    const { callerPermission, assignable } = resolveCallerAccess(catalog, "owner");
    expect(callerPermission).not.toBeNull();
    expect(assignable.map((role) => role.name)).toEqual(catalog.map((role) => role.name));
  });

  test("a member may only assign roles within their own permissions", () => {
    const { assignable } = resolveCallerAccess(catalog, "member");
    expect(assignable.map((role) => role.name)).not.toContain("owner");
    expect(assignable.map((role) => role.name)).toContain("member");
  });

  test("a member may assign a custom role whose permissions they already hold", () => {
    const { assignable } = resolveCallerAccess(catalog, "member");
    expect(assignable.find((role) => role.name === "viewer")?.builtIn).toBe(false);
  });
});
