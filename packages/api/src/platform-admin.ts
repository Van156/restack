import { ORPCError } from "@orpc/server";

/** User record from better-auth's admin endpoints; nullable fields mirror the DB columns (R6). */
export type PlatformUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role: string | null;
  banned: boolean | null;
  banReason: string | null;
  banExpires: Date | null;
  maxOrganizations: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type BanUserInput = {
  userId: string;
  reason: string;
  /** Optional expiry (R6.3); omitted means "banned indefinitely". */
  expiresInSeconds?: number;
};

export type SetOrganizationLimitInput = {
  userId: string;
  /** Non-negative override, or `null` to fall back to `DEFAULT_MAX_ORGS_PER_USER` (R6.6). */
  maxOrganizations: number | null;
};

/**
 * Port over better-auth's admin actions. Impersonation (R6.4) is deliberately excluded.
 * See docs/architecture/authorization.md#platform-admin-port
 */
export interface PlatformAdminPort {
  /** Fetches a single user by id. */
  getUser(headers: Headers, userId: string): Promise<PlatformUser>;
  /** R6.3: ban with a reason and optional expiry; better-auth revokes the target's sessions. */
  banUser(headers: Headers, input: BanUserInput): Promise<PlatformUser>;
  /** R6.3: unban. */
  unbanUser(headers: Headers, userId: string): Promise<PlatformUser>;
  /** R6.6: superadmin-only override of a user's organization-ownership limit. */
  setOrganizationLimit(headers: Headers, input: SetOrganizationLimitInput): Promise<PlatformUser>;
}

/**
 * Subset of better-auth's admin `api`. Members are `any` because its overloaded `StrictEndpoint`
 * types cannot satisfy a single-signature type; the adapter re-types each result.
 * See docs/architecture/authorization.md#platform-admin-port
 */
export type PlatformAdminAuthApi = {
  api: {
    /** GET `/admin/get-user` (`user:get`); returns the user unwrapped. */
    getUser: (input: any) => Promise<any>;
    /** POST `/admin/ban-user`; revokes sessions, refuses self-ban; returns `{ user }`. */
    banUser: (input: any) => Promise<any>;
    /** POST `/admin/unban-user`; returns `{ user }`. */
    unbanUser: (input: any) => Promise<any>;
    /** POST `/admin/update-user`; returns the user unwrapped, unlike ban/unban. */
    adminUpdateUser: (input: any) => Promise<any>;
  };
};

/** Structural shape of better-auth's `APIError` (see `authorization.ts`). */
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
 * Rethrows a mapped `APIError` code as an `ORPCError`; anything else propagates unchanged as a 500.
 * See docs/architecture/authorization.md#error-mapping
 */
function rethrowMapped(
  error: unknown,
  mapping: Record<string, { code: string; status?: number }>,
): never {
  if (isBetterAuthApiError(error)) {
    const bodyCode = error.body?.code;
    const mapped = bodyCode ? mapping[bodyCode] : undefined;
    if (mapped) {
      throw new ORPCError(mapped.code, { status: mapped.status, message: error.body?.message });
    }
  }
  throw error;
}

/** `PlatformAdminPort` adapter backed by better-auth's admin-plugin API (R6). */
export function createBetterAuthPlatformAdmin(auth: PlatformAdminAuthApi): PlatformAdminPort {
  return {
    async getUser(headers, userId) {
      try {
        const result = await auth.api.getUser({ headers, query: { id: userId } });
        return result as PlatformUser;
      } catch (error) {
        rethrowMapped(error, { USER_NOT_FOUND: { code: "NOT_FOUND" } });
      }
    },

    async banUser(headers, input) {
      try {
        const result = await auth.api.banUser({
          headers,
          body: {
            userId: input.userId,
            banReason: input.reason,
            banExpiresIn: input.expiresInSeconds,
          },
        });
        return (result as { user: PlatformUser }).user;
      } catch (error) {
        rethrowMapped(error, {
          YOU_CANNOT_BAN_YOURSELF: { code: "BAD_REQUEST" },
          USER_NOT_FOUND: { code: "NOT_FOUND" },
        });
      }
    },

    async unbanUser(headers, userId) {
      try {
        const result = await auth.api.unbanUser({ headers, body: { userId } });
        return (result as { user: PlatformUser }).user;
      } catch (error) {
        rethrowMapped(error, { USER_NOT_FOUND: { code: "NOT_FOUND" } });
      }
    },

    async setOrganizationLimit(headers, input) {
      try {
        const result = await auth.api.adminUpdateUser({
          headers,
          body: { userId: input.userId, data: { maxOrganizations: input.maxOrganizations } },
        });
        return result as PlatformUser;
      } catch (error) {
        rethrowMapped(error, { USER_NOT_FOUND: { code: "NOT_FOUND" } });
      }
    },
  };
}
