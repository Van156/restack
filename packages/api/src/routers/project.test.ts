import { call, ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, test } from "bun:test";

import type { AuthorizationPort } from "../authorization";
import type { Context } from "../context";
import { projectRouter, resetProjectsForTests } from "./project";

/**
 * Unit tests for the example `project` router's bounds (docs/specs/auth-multitenant-rbac.md
 * §4.2, T3.1e): a name length cap and a per-organization entry cap on this
 * in-memory demo. Uses a fake `AuthorizationPort` that always grants the
 * checked permission, mirroring `packages/api/src/index.test.ts`'s pattern.
 */

function fakeContext(organizationId: string): Context {
  const authorization: AuthorizationPort = {
    getActiveMembership: async () => ({ organizationId, memberId: "member-1", role: "owner" }),
    hasOrgPermission: async () => true,
    hasPlatformPermission: async () => true,
  };
  return {
    session: {
      session: { activeOrganizationId: organizationId },
      user: { id: "user-1" },
    } as unknown as Context["session"],
    db: {} as unknown as Context["db"],
    headers: new Headers(),
    authorization,
    // Unused by the router under test.
    platformAdmin: {} as unknown as Context["platformAdmin"],
    // Unused by the router under test.
    auditLogger: {} as unknown as Context["auditLogger"],
    defaultMaxOrganizationsPerUser: 3,
  };
}

describe("projectRouter", () => {
  beforeEach(() => {
    resetProjectsForTests();
  });

  test("rejects a name longer than 100 characters", async () => {
    const context = fakeContext("org-name-length");
    const tooLongName = "x".repeat(101);

    await expect(call(projectRouter.create, { name: tooLongName }, { context })).rejects.toThrow();
  });

  test("accepts a name exactly 100 characters long", async () => {
    const context = fakeContext("org-name-length-ok");
    const name = "x".repeat(100);

    const created = await call(projectRouter.create, { name }, { context });
    expect(created.name).toBe(name);
  });

  test("returns a clear error once an organization reaches the 100-entry demo limit", async () => {
    const context = fakeContext("org-entry-limit");
    for (let index = 0; index < 100; index += 1) {
      await call(projectRouter.create, { name: `Project ${index}` }, { context });
    }

    let createError: unknown;
    try {
      await call(projectRouter.create, { name: "One too many" }, { context });
    } catch (error) {
      createError = error;
    }

    expect(createError).toBeInstanceOf(ORPCError);
    expect((createError as ORPCError<string, unknown>).message).toContain("maximum");
    const list = await call(projectRouter.list, undefined, { context });
    expect(list).toHaveLength(100);
  });

  test("resetProjectsForTests clears the in-memory store between tests without relying on unique org ids", async () => {
    const context = fakeContext("org-reused-across-tests");
    await call(projectRouter.create, { name: "Leftover from a previous test" }, { context });

    resetProjectsForTests();

    const list = await call(projectRouter.list, undefined, { context });
    expect(list).toEqual([]);
  });
});
