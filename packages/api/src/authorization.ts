import type { orgStatements, platformStatements } from "@base-template/auth/permissions";

/** Permission-check input typed against a statements catalog; unknown features or actions fail to compile. */
type PermissionsFromStatements<TStatements extends Record<string, readonly string[]>> = {
  [TFeature in keyof TStatements]?: Array<TStatements[TFeature][number]>;
};

/** Permission shape accepted by `requirePermission`, typed against `orgStatements` (R5.1). */
export type OrgPermissions = PermissionsFromStatements<typeof orgStatements>;

/** Permission shape accepted by `platformProcedure`, typed against `platformStatements` (R6.5). */
export type PlatformPermissions = PermissionsFromStatements<typeof platformStatements>;

/** The caller's membership in the organization bound to their session. */
export type ActiveMembership = {
  organizationId: string;
  memberId: string;
  role: string;
};

/**
 * Authorization port the procedure builders depend on instead of better-auth.
 * See docs/architecture/authorization.md#authorization-port
 */
export interface AuthorizationPort {
  /** The caller's membership in the session's active organization, or `null` when not a member. */
  getActiveMembership(headers: Headers): Promise<ActiveMembership | null>;

  /** Whether the caller holds every permission in their active org; must honor custom roles (R4, R5.1). */
  hasOrgPermission(headers: Headers, permissions: Record<string, string[]>): Promise<boolean>;

  /** Whether the given user holds every given platform (operator-layer) permission. */
  hasPlatformPermission(userId: string, permissions: Record<string, string[]>): Promise<boolean>;
}

/** Structural subset of better-auth's `api` used here, so `packages/api` needs no better-auth import. */
export type AuthorizationAuthApi = {
  api: {
    /** GET `/organization/get-active-member`. */
    getActiveMember: (input: {
      headers: Headers;
    }) => Promise<{ id: string; organizationId: string; role: string }>;
    /** POST `/organization/has-permission`; resolves custom roles server-side (never use `checkRolePermission`). */
    hasPermission: (input: {
      headers: Headers;
      body: { permissions: Record<string, string[]> };
    }) => Promise<{ error: string | null; success: boolean }>;
    /** POST `/admin/has-permission` (admin plugin). */
    userHasPermission: (input: {
      body: { userId: string; permissions: Record<string, string[]> };
    }) => Promise<{ error: string | null; success: boolean }>;
  };
};

/**
 * Structural shape of better-auth's `APIError`, checked by `name` instead of `instanceof`
 * to avoid a runtime better-auth dependency. See docs/architecture/authorization.md#error-mapping
 */
type BetterAuthApiErrorShape = {
  status: string | number;
  body?: { code?: string; message?: string } | null;
};

function isBetterAuthApiError(error: unknown): error is BetterAuthApiErrorShape {
  return (
    typeof error === "object" && error !== null && (error as { name?: unknown }).name === "APIError"
  );
}

/**
 * Whether `error` is a documented "denied" outcome, matched by `body.code` or, for code-less
 * errors, by message. Anything else must propagate as a 500, not a silent denial.
 */
function isExpectedDenial(
  error: unknown,
  codes: readonly string[],
  messages: readonly string[] = [],
): boolean {
  if (!isBetterAuthApiError(error)) {
    return false;
  }
  const code = error.body?.code;
  if (code !== undefined && codes.includes(code)) {
    return true;
  }
  const message = error.body?.message;
  return message !== undefined && messages.includes(message);
}

/** Logs an unexpected failure by operation and error name/message only, never headers or permissions. */
function logUnexpectedAuthorizationError(operation: string, error: unknown): void {
  console.error(`[authorization] ${operation} failed unexpectedly`, {
    operation,
    errorName: error instanceof Error ? error.name : typeof error,
    errorMessage: error instanceof Error ? error.message : String(error),
  });
}

/**
 * `AuthorizationPort` backed by better-auth's organization and admin plugins. Documented denials
 * map to `null`/`false`; other errors are logged and rethrown.
 * See docs/architecture/authorization.md#error-mapping
 */
export function createBetterAuthAuthorization(auth: AuthorizationAuthApi): AuthorizationPort {
  return {
    async getActiveMembership(headers) {
      try {
        const member = await auth.api.getActiveMember({ headers });
        return { organizationId: member.organizationId, memberId: member.id, role: member.role };
      } catch (error) {
        if (isExpectedDenial(error, ["NO_ACTIVE_ORGANIZATION", "MEMBER_NOT_FOUND"])) {
          return null;
        }
        logUnexpectedAuthorizationError("getActiveMembership", error);
        throw error;
      }
    },
    async hasOrgPermission(headers, permissions) {
      try {
        const result = await auth.api.hasPermission({ headers, body: { permissions } });
        return result.success;
      } catch (error) {
        if (
          isExpectedDenial(error, [
            "NO_ACTIVE_ORGANIZATION",
            "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION",
          ])
        ) {
          return false;
        }
        logUnexpectedAuthorizationError("hasOrgPermission", error);
        throw error;
      }
    },
    async hasPlatformPermission(userId, permissions) {
      try {
        const result = await auth.api.userHasPermission({ body: { userId, permissions } });
        return result.success;
      } catch (error) {
        if (isExpectedDenial(error, [], ["user not found"])) {
          return false;
        }
        logUnexpectedAuthorizationError("hasPlatformPermission", error);
        throw error;
      }
    },
  };
}
