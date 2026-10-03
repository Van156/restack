import { describe, expect, test } from "bun:test";

import {
  assignableRoles,
  buildRoleCatalog,
  findRoleDefinition,
  groupCatalogByFeature,
  isDuplicateRoleName,
  isPermissionSubset,
  resolveCallerPermission,
} from "./role-catalog";

describe("buildRoleCatalog (R4)", () => {
  test("built-in roles come first, marked builtIn, then custom roles", () => {
    const catalog = buildRoleCatalog([
      { role: "billing-manager", permission: { project: ["read"] } },
    ]);
    expect(catalog.map((role) => role.name)).toEqual([
      "owner",
      "admin",
      "member",
      "cashier",
      "waiter",
      "billing-manager",
    ]);
    expect(catalog.filter((role) => role.builtIn).map((role) => role.name)).toEqual([
      "owner",
      "admin",
      "member",
      "cashier",
      "waiter",
    ]);
    expect(catalog.find((role) => role.name === "billing-manager")?.builtIn).toBe(false);
  });
});

describe("findRoleDefinition", () => {
  test("finds by exact name, case-sensitive", () => {
    const catalog = buildRoleCatalog([]);
    expect(findRoleDefinition(catalog, "owner")?.builtIn).toBe(true);
    expect(findRoleDefinition(catalog, "Owner")).toBeUndefined();
    expect(findRoleDefinition(catalog, "nope")).toBeUndefined();
  });
});

describe("isPermissionSubset (R2.2, R3.2, R4.2: no privilege escalation)", () => {
  test("true when every candidate permission is held", () => {
    expect(
      isPermissionSubset({ project: ["read"] }, { project: ["read", "create"], audit: ["read"] }),
    ).toBe(true);
  });

  test("false when a feature is missing entirely", () => {
    expect(isPermissionSubset({ audit: ["read"] }, { project: ["read"] })).toBe(false);
  });

  test("false when an action is missing for an otherwise-present feature", () => {
    expect(isPermissionSubset({ project: ["delete"] }, { project: ["read"] })).toBe(false);
  });

  test("an empty candidate is always a subset", () => {
    expect(isPermissionSubset({}, {})).toBe(true);
  });
});

describe("assignableRoles", () => {
  const catalog = buildRoleCatalog([
    { role: "billing-manager", permission: { project: ["read"] } },
    { role: "super-custom", permission: { project: ["read", "create", "update", "delete"] } },
  ]);

  test("unknown caller permission (role not resolved) assigns nothing", () => {
    expect(assignableRoles(catalog, null)).toEqual([]);
  });

  test("only returns roles whose permissions are all held by the caller", () => {
    // The built-in "member" role also grants `ac:read` (able to view roles),
    // so the caller needs that too to be able to assign "member".
    const result = assignableRoles(catalog, { project: ["read"], ac: ["read"] });
    expect(result.map((role) => role.name)).toEqual(["member", "billing-manager"]);
  });

  test("owner's full permission set can assign every role, including itself", () => {
    const owner = findRoleDefinition(catalog, "owner");
    expect(owner).toBeDefined();
    const result = assignableRoles(catalog, owner!.permission);
    expect(result.map((role) => role.name)).toContain("owner");
    expect(result.map((role) => role.name)).toContain("super-custom");
  });
});

describe("resolveCallerPermission", () => {
  const catalog = buildRoleCatalog([
    { role: "billing-manager", permission: { project: ["read"] } },
  ]);

  test("resolves a single built-in role", () => {
    expect(resolveCallerPermission("member", catalog)).toEqual(
      findRoleDefinition(catalog, "member")?.permission ?? null,
    );
  });

  test("resolves a single custom role", () => {
    expect(resolveCallerPermission("billing-manager", catalog)).toEqual({ project: ["read"] });
  });

  test("unions permissions across a comma-separated multi-role member", () => {
    const result = resolveCallerPermission("member,billing-manager", catalog);
    expect(result?.project?.sort()).toEqual(["read"]);
    // member already grants project:read; audit:read comes only from... neither
    // role here grants audit, so assert project stays deduplicated:
    expect(result?.project).toEqual(["read"]);
  });

  test("an unresolvable role name returns null", () => {
    expect(resolveCallerPermission("ghost-role", catalog)).toBeNull();
  });

  test("a mix of a known and unknown role still resolves using the known one", () => {
    expect(resolveCallerPermission("ghost-role,billing-manager", catalog)).toEqual({
      project: ["read"],
    });
  });
});

describe("groupCatalogByFeature (R4.1: a new feature shows up automatically)", () => {
  test("groups the full catalog by feature with its actions", () => {
    const groups = groupCatalogByFeature();
    const projectGroup = groups.find((group) => group.feature === "project");
    expect(projectGroup?.actions.sort()).toEqual(["create", "delete", "read", "update"]);
    const auditGroup = groups.find((group) => group.feature === "audit");
    expect(auditGroup?.actions).toEqual(["read"]);
    // No duplicate feature entries.
    expect(new Set(groups.map((group) => group.feature)).size).toBe(groups.length);
  });
});

describe("isDuplicateRoleName (T9 follow-up e: matching better-auth's ACTUAL role-name semantics)", () => {
  // Verified against the installed better-auth 1.7.5 source
  // (`dist/plugins/organization/routes/crud-access-control.mjs`):
  // `normalizeRoleName = (role) => role.toLowerCase()` is applied to the
  // incoming role name BEFORE both the pre-defined-role collision check and
  // the DB uniqueness check, and that same lowercased value is what gets
  // persisted to `organizationRole.role`. Role-name uniqueness is therefore
  // case-INSENSITIVE via lowercase folding — not case-sensitive.
  const existingNames = ["owner", "admin", "member", "billing-manager"];

  test("an exact match is a duplicate", () => {
    expect(isDuplicateRoleName("billing-manager", existingNames)).toBe(true);
  });

  test("a case-different match is STILL a duplicate (better-auth folds to lowercase)", () => {
    expect(isDuplicateRoleName("Billing-Manager", existingNames)).toBe(true);
    expect(isDuplicateRoleName("ADMIN", existingNames)).toBe(true);
    expect(isDuplicateRoleName("Owner", existingNames)).toBe(true);
  });

  test("a genuinely new name is not a duplicate", () => {
    expect(isDuplicateRoleName("support-agent", existingNames)).toBe(false);
  });
});
