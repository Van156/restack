import { describe, expect, test } from "bun:test";

import { deriveCanState } from "./can-state";

const okRole = { isError: false, error: null, data: "owner" as string | undefined };
const pendingRole = { isError: false, error: null, data: undefined as string | undefined };
const erroredRole = (error: unknown) => ({
  isError: true,
  error,
  data: undefined as string | undefined,
});

const canQuery = (overrides: Partial<Parameters<typeof deriveCanState>[0]["canQuery"]> = {}) => ({
  isError: false,
  error: null,
  data: undefined as boolean | undefined,
  isPending: true,
  ...overrides,
});

describe("deriveCanState (T7 review follow-up c)", () => {
  test("no active organization: settled false, never pending", () => {
    expect(
      deriveCanState({
        activeOrganizationId: undefined,
        activeMemberRole: pendingRole,
        canQuery: canQuery(),
      }),
    ).toEqual({ can: false, isPending: false, error: null });
  });

  test("the active-member-role query failing settles to false with the error, instead of pending forever", () => {
    const error = new Error("role lookup failed");
    expect(
      deriveCanState({
        activeOrganizationId: "org-1",
        activeMemberRole: erroredRole(error),
        canQuery: canQuery({ isPending: true }),
      }),
    ).toEqual({ can: false, isPending: false, error });
  });

  test("the can query failing settles to false with the error, instead of pending forever", () => {
    const error = new Error("hasPermission failed");
    expect(
      deriveCanState({
        activeOrganizationId: "org-1",
        activeMemberRole: okRole,
        canQuery: canQuery({ isError: true, error, isPending: false }),
      }),
    ).toEqual({ can: false, isPending: false, error });
  });

  test("still resolving (role known, permission check pending): isPending true, no error", () => {
    expect(
      deriveCanState({
        activeOrganizationId: "org-1",
        activeMemberRole: okRole,
        canQuery: canQuery({ isPending: true, data: undefined }),
      }),
    ).toEqual({ can: false, isPending: true, error: null });
  });

  test("resolved true", () => {
    expect(
      deriveCanState({
        activeOrganizationId: "org-1",
        activeMemberRole: okRole,
        canQuery: canQuery({ isPending: false, data: true }),
      }),
    ).toEqual({ can: true, isPending: false, error: null });
  });

  test("resolved false", () => {
    expect(
      deriveCanState({
        activeOrganizationId: "org-1",
        activeMemberRole: okRole,
        canQuery: canQuery({ isPending: false, data: false }),
      }),
    ).toEqual({ can: false, isPending: false, error: null });
  });
});
