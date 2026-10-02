import { describe, expect, spyOn, test } from "bun:test";

import type { AuthorizationAuthApi } from "./authorization";
import { createBetterAuthAuthorization } from "./authorization";

/**
 * Unit tests for `createBetterAuthAuthorization` (docs/specs/auth-multitenant-rbac.md
 * §4.5, T3.1b) using a FAKE `AuthorizationAuthApi` (no DB, no real better-auth
 * instance). Exercises both paths the adapter must distinguish:
 *
 * - better-auth's documented "denied" outcomes (no active organization, not a
 *   member, user not found) → mapped to `null` / `false`.
 * - anything else (a DB-down error, a timeout, an `APIError` with an
 *   unrecognized code) → propagated (so oRPC turns it into a 500), and logged
 *   once via `console.error` with no secrets (no headers, no raw permissions
 *   payload).
 */

/** Mirrors the structural shape of better-auth 1.7.5's `@better-auth/core` `APIError` (see authorization.ts). */
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

describe("createBetterAuthAuthorization", () => {
  describe("getActiveMembership", () => {
    test("NO_ACTIVE_ORGANIZATION -> null", async () => {
      const auth: AuthorizationAuthApi = {
        api: {
          getActiveMember: async () => {
            throw new FakeBetterAuthApiError("BAD_REQUEST", {
              code: "NO_ACTIVE_ORGANIZATION",
              message: "No active organization",
            });
          },
          hasPermission: async () => ({ error: null, success: false }),
          userHasPermission: async () => ({ error: null, success: false }),
        },
      };
      const port = createBetterAuthAuthorization(auth);
      await expect(port.getActiveMembership(new Headers())).resolves.toBeNull();
    });

    test("MEMBER_NOT_FOUND -> null", async () => {
      const auth: AuthorizationAuthApi = {
        api: {
          getActiveMember: async () => {
            throw new FakeBetterAuthApiError("BAD_REQUEST", {
              code: "MEMBER_NOT_FOUND",
              message: "Member not found",
            });
          },
          hasPermission: async () => ({ error: null, success: false }),
          userHasPermission: async () => ({ error: null, success: false }),
        },
      };
      const port = createBetterAuthAuthorization(auth);
      await expect(port.getActiveMembership(new Headers())).resolves.toBeNull();
    });

    test("an infrastructure error propagates and is logged once", async () => {
      const errorSpy = spyOn(console, "error").mockImplementation(() => {});
      const dbError = new Error("Connection terminated unexpectedly");
      const auth: AuthorizationAuthApi = {
        api: {
          getActiveMember: async () => {
            throw dbError;
          },
          hasPermission: async () => ({ error: null, success: false }),
          userHasPermission: async () => ({ error: null, success: false }),
        },
      };
      const port = createBetterAuthAuthorization(auth);
      await expect(port.getActiveMembership(new Headers())).rejects.toBe(dbError);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      const loggedArgs = errorSpy.mock.calls[0] ?? [];
      expect(JSON.stringify(loggedArgs)).not.toContain("cookie");
      errorSpy.mockRestore();
    });

    test("an APIError with an unrecognized code propagates and is logged once", async () => {
      const errorSpy = spyOn(console, "error").mockImplementation(() => {});
      const auth: AuthorizationAuthApi = {
        api: {
          getActiveMember: async () => {
            throw new FakeBetterAuthApiError("INTERNAL_SERVER_ERROR", {
              code: "SOME_UNRELATED_ERROR",
              message: "Something else broke",
            });
          },
          hasPermission: async () => ({ error: null, success: false }),
          userHasPermission: async () => ({ error: null, success: false }),
        },
      };
      const port = createBetterAuthAuthorization(auth);
      await expect(port.getActiveMembership(new Headers())).rejects.toThrow("Something else broke");
      expect(errorSpy).toHaveBeenCalledTimes(1);
      errorSpy.mockRestore();
    });
  });

  describe("hasOrgPermission", () => {
    test("USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION -> false", async () => {
      const auth: AuthorizationAuthApi = {
        api: {
          getActiveMember: async () => {
            throw new Error("unused");
          },
          hasPermission: async () => {
            throw new FakeBetterAuthApiError("UNAUTHORIZED", {
              code: "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION",
              message: "User is not a member of the organization",
            });
          },
          userHasPermission: async () => ({ error: null, success: false }),
        },
      };
      const port = createBetterAuthAuthorization(auth);
      await expect(port.hasOrgPermission(new Headers(), { project: ["read"] })).resolves.toBe(
        false,
      );
    });

    test("a normal denial (success: false, no throw) resolves to false", async () => {
      const auth: AuthorizationAuthApi = {
        api: {
          getActiveMember: async () => {
            throw new Error("unused");
          },
          hasPermission: async () => ({ error: null, success: false }),
          userHasPermission: async () => ({ error: null, success: false }),
        },
      };
      const port = createBetterAuthAuthorization(auth);
      await expect(port.hasOrgPermission(new Headers(), { project: ["read"] })).resolves.toBe(
        false,
      );
    });

    test("an infrastructure error propagates and is logged once", async () => {
      const errorSpy = spyOn(console, "error").mockImplementation(() => {});
      const timeoutError = new Error("Query timeout");
      const auth: AuthorizationAuthApi = {
        api: {
          getActiveMember: async () => {
            throw new Error("unused");
          },
          hasPermission: async () => {
            throw timeoutError;
          },
          userHasPermission: async () => ({ error: null, success: false }),
        },
      };
      const port = createBetterAuthAuthorization(auth);
      await expect(port.hasOrgPermission(new Headers(), { project: ["read"] })).rejects.toBe(
        timeoutError,
      );
      expect(errorSpy).toHaveBeenCalledTimes(1);
      errorSpy.mockRestore();
    });
  });

  describe("hasPlatformPermission", () => {
    test('"user not found" (no active session, no matching user) -> false', async () => {
      const auth: AuthorizationAuthApi = {
        api: {
          getActiveMember: async () => {
            throw new Error("unused");
          },
          hasPermission: async () => ({ error: null, success: false }),
          userHasPermission: async () => {
            throw new FakeBetterAuthApiError("BAD_REQUEST", { message: "user not found" });
          },
        },
      };
      const port = createBetterAuthAuthorization(auth);
      await expect(port.hasPlatformPermission("user-1", { user: ["list"] })).resolves.toBe(false);
    });

    test("an infrastructure error propagates and is logged once", async () => {
      const errorSpy = spyOn(console, "error").mockImplementation(() => {});
      const dbError = new Error("ECONNREFUSED");
      const auth: AuthorizationAuthApi = {
        api: {
          getActiveMember: async () => {
            throw new Error("unused");
          },
          hasPermission: async () => ({ error: null, success: false }),
          userHasPermission: async () => {
            throw dbError;
          },
        },
      };
      const port = createBetterAuthAuthorization(auth);
      await expect(port.hasPlatformPermission("user-1", { user: ["list"] })).rejects.toBe(dbError);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      errorSpy.mockRestore();
    });
  });
});
