import { ORPCError } from "@orpc/server";
import { describe, expect, test } from "bun:test";

import type { PlatformAdminAuthApi, PlatformUser } from "./platform-admin";
import { createBetterAuthPlatformAdmin } from "./platform-admin";

/**
 * Unit tests for `createBetterAuthPlatformAdmin` (docs/specs/auth-multitenant-rbac.md
 * R6) using a FAKE `PlatformAdminAuthApi` (no DB, no real better-auth
 * instance) — mirrors `authorization.test.ts`'s pattern for the sibling
 * `AuthorizationPort` adapter.
 */

/** Mirrors the structural shape of better-auth 1.7.5's `@better-auth/core` `APIError` (see `authorization.ts`). */
class FakeBetterAuthApiError extends Error {
  readonly status: string;
  readonly body: { code?: string; message: string };

  constructor(status: string, body: { code?: string; message: string }) {
    super(body.message);
    this.name = "APIError";
    this.status = status;
    this.body = body;
  }
}

const fakeUser: PlatformUser = {
  id: "user-1",
  email: "user-1@example.com",
  name: "User One",
  emailVerified: true,
  role: "user",
  banned: false,
  banReason: null,
  banExpires: null,
  maxOrganizations: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function fakeAuth(overrides: Partial<PlatformAdminAuthApi["api"]> = {}): PlatformAdminAuthApi {
  return {
    api: {
      getUser: async () => fakeUser,
      banUser: async () => ({ user: fakeUser }),
      unbanUser: async () => ({ user: fakeUser }),
      adminUpdateUser: async () => fakeUser,
      ...overrides,
    },
  };
}

describe("createBetterAuthPlatformAdmin", () => {
  describe("banUser", () => {
    test("maps YOU_CANNOT_BAN_YOURSELF to a BAD_REQUEST ORPCError", async () => {
      const auth = fakeAuth({
        banUser: async () => {
          throw new FakeBetterAuthApiError("BAD_REQUEST", {
            code: "YOU_CANNOT_BAN_YOURSELF",
            message: "You cannot ban yourself",
          });
        },
      });
      const port = createBetterAuthPlatformAdmin(auth);

      let caught: unknown;
      try {
        await port.banUser(new Headers(), { userId: "self", reason: "test" });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ORPCError);
      expect((caught as ORPCError<string, unknown>).code).toBe("BAD_REQUEST");
    });

    test("maps USER_NOT_FOUND to a NOT_FOUND ORPCError", async () => {
      const auth = fakeAuth({
        banUser: async () => {
          throw new FakeBetterAuthApiError("NOT_FOUND", {
            code: "USER_NOT_FOUND",
            message: "User not found",
          });
        },
      });
      const port = createBetterAuthPlatformAdmin(auth);

      let caught: unknown;
      try {
        await port.banUser(new Headers(), { userId: "missing", reason: "test" });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(ORPCError);
      expect((caught as ORPCError<string, unknown>).code).toBe("NOT_FOUND");
    });

    test("an unrecognized/infrastructure error propagates unchanged (T3.1b policy)", async () => {
      const dbError = new Error("Connection terminated unexpectedly");
      const auth = fakeAuth({
        banUser: async () => {
          throw dbError;
        },
      });
      const port = createBetterAuthPlatformAdmin(auth);

      await expect(port.banUser(new Headers(), { userId: "x", reason: "test" })).rejects.toBe(
        dbError,
      );
    });

    test("passes reason and expiresInSeconds through as banReason/banExpiresIn", async () => {
      let capturedBody: unknown;
      const auth = fakeAuth({
        banUser: async (input) => {
          capturedBody = input.body;
          return { user: fakeUser };
        },
      });
      const port = createBetterAuthPlatformAdmin(auth);

      await port.banUser(new Headers(), {
        userId: "user-2",
        reason: "spam",
        expiresInSeconds: 3600,
      });

      expect(capturedBody).toEqual({
        userId: "user-2",
        banReason: "spam",
        banExpiresIn: 3600,
      });
    });
  });

  describe("unbanUser", () => {
    test("maps USER_NOT_FOUND to a NOT_FOUND ORPCError", async () => {
      const auth = fakeAuth({
        unbanUser: async () => {
          throw new FakeBetterAuthApiError("NOT_FOUND", {
            code: "USER_NOT_FOUND",
            message: "User not found",
          });
        },
      });
      const port = createBetterAuthPlatformAdmin(auth);

      const result = port.unbanUser(new Headers(), "missing");
      await expect(result).rejects.toBeInstanceOf(ORPCError);
      await expect(result).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("getUser", () => {
    test("fetches by id via GET /admin/get-user", async () => {
      let capturedQuery: unknown;
      const auth = fakeAuth({
        getUser: async (input) => {
          capturedQuery = input.query;
          return fakeUser;
        },
      });
      const port = createBetterAuthPlatformAdmin(auth);

      const result = await port.getUser(new Headers(), "user-1");

      expect(capturedQuery).toEqual({ id: "user-1" });
      expect(result).toBe(fakeUser);
    });

    test("maps USER_NOT_FOUND to a NOT_FOUND ORPCError", async () => {
      const auth = fakeAuth({
        getUser: async () => {
          throw new FakeBetterAuthApiError("NOT_FOUND", {
            code: "USER_NOT_FOUND",
            message: "User not found",
          });
        },
      });
      const port = createBetterAuthPlatformAdmin(auth);

      const result = port.getUser(new Headers(), "missing");
      await expect(result).rejects.toBeInstanceOf(ORPCError);
      await expect(result).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("setOrganizationLimit", () => {
    test("sends maxOrganizations under data, and returns the updated user", async () => {
      let capturedBody: unknown;
      const auth = fakeAuth({
        adminUpdateUser: async (input) => {
          capturedBody = input.body;
          return fakeUser;
        },
      });
      const port = createBetterAuthPlatformAdmin(auth);

      const result = await port.setOrganizationLimit(new Headers(), {
        userId: "user-1",
        maxOrganizations: 5,
      });

      expect(capturedBody).toEqual({ userId: "user-1", data: { maxOrganizations: 5 } });
      expect(result).toBe(fakeUser);
    });

    test("passes null through to clear the override back to the default (R6.6)", async () => {
      let capturedBody: unknown;
      const auth = fakeAuth({
        adminUpdateUser: async (input) => {
          capturedBody = input.body;
          return fakeUser;
        },
      });
      const port = createBetterAuthPlatformAdmin(auth);

      await port.setOrganizationLimit(new Headers(), { userId: "user-1", maxOrganizations: null });

      expect(capturedBody).toEqual({ userId: "user-1", data: { maxOrganizations: null } });
    });
  });
});
