import { describe, expect, test } from "bun:test";

import { admin, member, orgAc, orgStatements, owner } from "./org";

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
