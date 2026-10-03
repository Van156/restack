import { describe, expect, test } from "bun:test";

import { admin, cashier, member, orgAc, orgRoles, orgStatements, owner, waiter } from "./org";

describe("orgStatements", () => {
  test("extends better-auth organization defaults with audit and project", () => {
    expect(orgStatements.audit).toEqual(["read"]);
    expect(orgStatements.project).toEqual(["create", "read", "update", "delete"]);
  });

  test("keeps better-auth's built-in organization statements untouched", () => {
    expect(orgStatements.organization).toEqual(["update", "delete"]);
    expect(orgStatements.member).toEqual(["create", "update", "delete"]);
    expect(orgStatements.invitation).toEqual(["create", "cancel"]);
    expect(orgStatements.ac).toEqual(["create", "read", "update", "delete"]);
  });

  test("excludes better-auth's team statements (teams are out of scope for v1)", () => {
    expect((orgStatements as Record<string, unknown>).team).toBeUndefined();
    expect(Object.keys(orgStatements)).not.toContain("team");
  });
});

describe("orgAc", () => {
  test("is built from orgStatements", () => {
    expect(orgAc.statements).toBe(orgStatements);
  });
});

describe("owner role", () => {
  test("has audit:read", () => {
    expect(owner.authorize({ audit: ["read"] }).success).toBe(true);
  });

  test("has full project access", () => {
    expect(owner.authorize({ project: ["create", "read", "update", "delete"] }).success).toBe(true);
  });

  test("keeps better-auth's owner-only permissions (e.g. organization:delete)", () => {
    expect(owner.authorize({ organization: ["delete"] }).success).toBe(true);
  });

  test("does not grant team permissions (teams are out of scope for v1)", () => {
    expect((owner.statements as Record<string, unknown>).team).toBeUndefined();
  });
});

describe("admin role", () => {
  test("has audit:read", () => {
    expect(admin.authorize({ audit: ["read"] }).success).toBe(true);
  });

  test("has full project access", () => {
    expect(admin.authorize({ project: ["create", "read", "update", "delete"] }).success).toBe(true);
  });

  test("does not have owner-only permissions (e.g. organization:delete)", () => {
    expect(admin.authorize({ organization: ["delete"] }).success).toBe(false);
  });

  test("does not grant team permissions (teams are out of scope for v1)", () => {
    expect((admin.statements as Record<string, unknown>).team).toBeUndefined();
  });
});

describe("member role", () => {
  test("can only read project", () => {
    expect(member.authorize({ project: ["read"] }).success).toBe(true);
    expect(member.authorize({ project: ["create"] }).success).toBe(false);
  });

  test("has no audit access", () => {
    expect(member.authorize({ audit: ["read"] }).success).toBe(false);
  });
});

describe("restaurant permission catalog", () => {
  const ownerOnly = [
    { subscription: ["manage"] },
    { restaurant: ["delete"] },
    { dian: ["choose"] },
  ] as const;
  const adminAndOwner = [
    { dian: ["connect"] },
    { setup: ["manage"] },
    { staff: ["manage"] },
    { report: ["read"] },
    { override: ["give"] },
  ] as const;
  const cashierAndUp = [
    { cashShift: ["manage"] },
    { billing: ["charge"] },
    { menu: ["soldOut"] },
    { order: ["take"] },
  ] as const;

  test("Owner holds every restaurant permission", () => {
    for (const permission of [...ownerOnly, ...adminAndOwner, ...cashierAndUp]) {
      expect(owner.authorize(permission as never).success).toBe(true);
    }
  });

  test("Administrator holds everything except subscription, restaurant delete and DIAN choice", () => {
    for (const permission of ownerOnly) {
      expect(admin.authorize(permission as never).success).toBe(false);
    }
    for (const permission of [...adminAndOwner, ...cashierAndUp]) {
      expect(admin.authorize(permission as never).success).toBe(true);
    }
  });

  test("Cashier takes orders, charges, manages the Cash shift and marks sold out; nothing else", () => {
    for (const permission of cashierAndUp) {
      expect(cashier.authorize(permission as never).success).toBe(true);
    }
    for (const permission of [...ownerOnly, ...adminAndOwner]) {
      expect(cashier.authorize(permission as never).success).toBe(false);
    }
  });

  test("Waiter takes orders and holds the catalog-level charge permission only", () => {
    expect(waiter.authorize({ order: ["take"] }).success).toBe(true);
    expect(waiter.authorize({ billing: ["charge"] }).success).toBe(true);
    expect(waiter.authorize({ cashShift: ["manage"] }).success).toBe(false);
    expect(waiter.authorize({ menu: ["soldOut"] }).success).toBe(false);
    for (const permission of [...ownerOnly, ...adminAndOwner]) {
      expect(waiter.authorize(permission as never).success).toBe(false);
    }
  });

  test("the generic member role keeps working and gets no restaurant permission", () => {
    expect(member.authorize({ project: ["read"] }).success).toBe(true);
    expect(member.authorize({ order: ["take"] }).success).toBe(false);
  });

  test("cashier and waiter are registered as built-in roles", () => {
    expect(Object.keys(orgRoles)).toEqual(["owner", "admin", "member", "cashier", "waiter"]);
  });
});
