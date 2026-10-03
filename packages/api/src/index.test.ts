import { call, ORPCError } from "@orpc/server";
import { describe, expect, test } from "bun:test";

import type { AuthorizationPort } from "./authorization";
import {
  orgProcedure,
  platformProcedure,
  protectedProcedure,
  publicProcedure,
  requirePermission,
} from "./index";
import type { Context } from "./context";

/**
 * Unit tests for the oRPC procedure builders (docs/specs/auth-multitenant-rbac.md
 * §4.5, R5). Uses a FAKE `AuthorizationPort` (no DB) so these run everywhere,
 * fast; DB-backed behavior (dynamic roles, tenant isolation) is covered by
 * `authorization.integration.test.ts`.
 */

/** A `Context["session"]` fixture. Cast because the real `Session` type
 * (better-auth's `$Infer.Session`) carries many generated fields (tokens,
 * timestamps, admin/org plugin fields) irrelevant to the builders under
 * test — only `session.activeOrganizationId` and `user.id` are read. */
function fakeSession(options: {
  activeOrganizationId?: string;
  userId?: string;
}): Context["session"] {
  return {
    session: {
      activeOrganizationId: options.activeOrganizationId,
    },
    user: {
      id: options.userId ?? "user-1",
    },
  } as unknown as Context["session"];
}

/** Builds a fully-fake `Context` for `call()`, with a controllable `AuthorizationPort`. */
function fakeContext(overrides: {
  session?: Context["session"];
  authorization?: Partial<AuthorizationPort>;
}): Context {
  const authorization: AuthorizationPort = {
    getActiveMembership: async () => null,
    hasOrgPermission: async () => false,
    hasPlatformPermission: async () => false,
    ...overrides.authorization,
  };
  return {
    session: overrides.session ?? null,
    // Unused by any builder under test; a real Database is not needed.
    db: {} as unknown as Context["db"],
    headers: new Headers(),
    authorization,
    // Unused by any builder under test.
    platformAdmin: {} as unknown as Context["platformAdmin"],
    // Unused by any builder under test.
    auditLogger: {} as unknown as Context["auditLogger"],
    defaultMaxOrganizationsPerUser: 3,
    clock: { now: () => new Date() },
    actingTokenSecret: "test-acting-token-secret-0000000",
  };
}

const echoHandler = protectedProcedure.handler(({ context }) => context.session?.user.id);

describe("protectedProcedure", () => {
  test("no session -> UNAUTHORIZED", async () => {
    await expect(
      call(echoHandler, undefined, { context: fakeContext({ session: null }) }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("valid session -> handler runs", async () => {
    const session = fakeSession({ userId: "user-42" });
    const result = await call(echoHandler, undefined, { context: fakeContext({ session }) });
    expect(result).toBe("user-42");
  });
});

const orgHandler = orgProcedure.handler(({ context }) => context.org);

describe("orgProcedure", () => {
  test("no session -> UNAUTHORIZED", async () => {
    await expect(
      call(orgHandler, undefined, { context: fakeContext({ session: null }) }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("no active organization on session -> NO_ACTIVE_ORGANIZATION", async () => {
    const session = fakeSession({});
    await expect(
      call(orgHandler, undefined, { context: fakeContext({ session }) }),
    ).rejects.toMatchObject({
      code: "NO_ACTIVE_ORGANIZATION",
      status: 409,
    });
  });

  test("active organization set but caller is not a member -> FORBIDDEN", async () => {
    const session = fakeSession({ activeOrganizationId: "org-1" });
    const context = fakeContext({
      session,
      authorization: { getActiveMembership: async () => null },
    });
    await expect(call(orgHandler, undefined, { context })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("active organization + member -> handler runs with context.org from the membership", async () => {
    const session = fakeSession({ activeOrganizationId: "org-1" });
    const context = fakeContext({
      session,
      authorization: {
        getActiveMembership: async () => ({
          organizationId: "org-1",
          memberId: "member-1",
          role: "member",
        }),
      },
    });
    const result = await call(orgHandler, undefined, { context });
    expect(result).toEqual({ id: "org-1" });
  });
});

const requireProjectRead = orgProcedure
  .use(requirePermission({ project: ["read"] }))
  .handler(({ context }) => context.member);

describe("requirePermission", () => {
  test("missing permission -> FORBIDDEN", async () => {
    const session = fakeSession({ activeOrganizationId: "org-1" });
    const context = fakeContext({
      session,
      authorization: {
        getActiveMembership: async () => ({
          organizationId: "org-1",
          memberId: "member-1",
          role: "member",
        }),
        hasOrgPermission: async () => false,
      },
    });
    await expect(call(requireProjectRead, undefined, { context })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("granted permission -> handler runs", async () => {
    const session = fakeSession({ activeOrganizationId: "org-1" });
    let calledWith: { headers: Headers; permissions: Record<string, string[]> } | undefined;
    const context = fakeContext({
      session,
      authorization: {
        getActiveMembership: async () => ({
          organizationId: "org-1",
          memberId: "member-1",
          role: "admin",
        }),
        hasOrgPermission: async (headers, permissions) => {
          calledWith = { headers, permissions };
          return true;
        },
      },
    });
    const result = await call(requireProjectRead, undefined, { context });
    expect(result).toEqual({ id: "member-1", role: "admin" });
    expect(calledWith?.permissions).toEqual({ project: ["read"] });
  });

  test("type-level: a misspelled feature key is a compile-time error", () => {
    // @ts-expect-error "projct" is not a key of orgStatements.
    requirePermission({ projct: ["create"] });
    // @ts-expect-error "publish" is not a declared action of "project".
    requirePermission({ project: ["publish"] });
    expect(true).toBe(true);
  });
});

describe("platformProcedure", () => {
  test("no session -> UNAUTHORIZED", async () => {
    const platformPing = platformProcedure({ user: ["list"] }).handler(() => "pong");
    await expect(
      call(platformPing, undefined, { context: fakeContext({ session: null }) }),
    ).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("org owner without a platform role -> FORBIDDEN (layer isolation, R6.5)", async () => {
    const platformPing = platformProcedure({ user: ["list"] }).handler(() => "pong");
    const session = fakeSession({ userId: "owner-1" });
    const context = fakeContext({
      session,
      authorization: { hasPlatformPermission: async () => false },
    });
    await expect(call(platformPing, undefined, { context })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("superadmin -> handler runs", async () => {
    const platformPing = platformProcedure({ user: ["list"] }).handler(() => "pong");
    const session = fakeSession({ userId: "superadmin-1" });
    let calledWith: { userId: string; permissions: Record<string, string[]> } | undefined;
    const context = fakeContext({
      session,
      authorization: {
        hasPlatformPermission: async (userId, permissions) => {
          calledWith = { userId, permissions };
          return true;
        },
      },
    });
    const result = await call(platformPing, undefined, { context });
    expect(result).toBe("pong");
    expect(calledWith).toEqual({ userId: "superadmin-1", permissions: { user: ["list"] } });
  });
});

// Behavior tests for `publicProcedure` (no auth guard at all) and for the
// `ORPCError` instances the other builders above throw (asserted here via
// `echoHandler`, which requires a session).
describe("publicProcedure", () => {
  test("runs without a session", async () => {
    const health = publicProcedure.handler(() => "OK");
    const result = await call(health, undefined, { context: fakeContext({ session: null }) });
    expect(result).toBe("OK");
  });

  test("ORPCError carries the code thrown by the builders", async () => {
    await expect(
      call(echoHandler, undefined, { context: fakeContext({ session: null }) }),
    ).rejects.toBeInstanceOf(ORPCError);
  });
});
