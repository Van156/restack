import { describe, expect, test } from "bun:test";

import type { InvitationRow } from "../types";
import {
  getInvitationRoleOptions,
  invitationsAccessors,
  invitationsSearchConfig,
  invitationsSearchDefaults,
  invitationsSearchSchema,
  toInvitationsListState,
} from "./invitations-list";

const invitation = (id: string, role: string, expiresAt: string | Date): InvitationRow => ({
  id,
  email: `${id}@example.com`,
  role,
  status: "pending",
  expiresAt,
});

describe("invitations search", () => {
  test("config: sort by email, role and expiry; filter by email and role", () => {
    expect([...invitationsSearchConfig.columnIds]).toEqual(["email", "role", "expiresAt"]);
    expect([...invitationsSearchConfig.filterableColumnIds]).toEqual(["email", "role"]);
  });

  test("defaults: soonest expiry first (the order invitations were sent), 10 per page", () => {
    expect(invitationsSearchDefaults).toEqual({
      page: 1,
      perPage: 10,
      sort: [{ id: "expiresAt", desc: false }],
      filters: [],
      joinOperator: "and",
    });
  });

  test("keeps simple filters and drops advanced ones and over-long values", () => {
    const search = invitationsSearchSchema.parse({
      email: "ada",
      role: "x".repeat(257),
      filters: [{ id: "email", value: "x", variant: "text", operator: "iLike", filterId: "f1" }],
      joinOperator: "or",
    });
    expect(search.email).toBe("ada");
    expect(search).not.toHaveProperty("role");
    expect(search.filters).toEqual([]);
    expect(search.joinOperator).toBe("and");
  });
});

describe("toInvitationsListState", () => {
  test("turns simple filters into list filters with the variants' default operators", () => {
    const state = toInvitationsListState(
      invitationsSearchSchema.parse({ email: "ada", role: "admin", page: 2, perPage: 20 }),
    );
    expect(state.page).toBe(2);
    expect(state.perPage).toBe(20);
    expect(state.filters.map((filter) => [filter.id, filter.operator, filter.value])).toEqual([
      ["email", "iLike", "ada"],
      ["role", "eq", "admin"],
    ]);
  });
});

describe("invitationsAccessors", () => {
  test("sort by email, role and expiry time (a Date and an ISO string agree)", () => {
    const row = invitation("a", "admin", "2026-01-02T00:00:00.000Z");
    expect(invitationsAccessors.sort.email?.(row)).toBe("a@example.com");
    expect(invitationsAccessors.sort.role?.(row)).toBe("admin");
    expect(invitationsAccessors.sort.expiresAt?.(row)).toBe(Date.parse("2026-01-02T00:00:00.000Z"));
    expect(
      invitationsAccessors.sort.expiresAt?.(invitation("b", "admin", new Date("2026-01-02Z"))),
    ).toBe(Date.parse("2026-01-02T00:00:00.000Z"));
  });

  test("filter on email and role text", () => {
    const row = invitation("a", "admin", "2026-01-02T00:00:00.000Z");
    expect(invitationsAccessors.filter.email?.(row)).toBe("a@example.com");
    expect(invitationsAccessors.filter.role?.(row)).toBe("admin");
  });
});

describe("getInvitationRoleOptions", () => {
  test("lists each role once, sorted, as filter options", () => {
    const options = getInvitationRoleOptions([
      invitation("1", "member", "2026-01-01"),
      invitation("2", "admin", "2026-01-01"),
      invitation("3", "member", "2026-01-01"),
    ]);
    expect(options).toEqual([
      { label: "admin", value: "admin" },
      { label: "member", value: "member" },
    ]);
  });

  test("is empty for no invitations", () => {
    expect(getInvitationRoleOptions([])).toEqual([]);
  });
});
