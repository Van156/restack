import { describe, expect, test } from "bun:test";

import { createListInput } from "./list-input";
import { orgMembersListConfig } from "./members-list-config";

const members = createListInput(orgMembersListConfig);

describe("orgMembersListConfig", () => {
  test("defaults to join order: oldest member first", () => {
    expect(members.parse({}).sort).toEqual([{ id: "createdAt", desc: false }]);
  });

  test("sorts by name, email, role and createdAt and by nothing else", () => {
    for (const id of ["name", "email", "role", "createdAt"]) {
      expect(members.safeParse({ sort: [{ id, desc: false }] }).success).toBe(true);
    }
    expect(members.safeParse({ sort: [{ id: "userId", desc: false }] }).success).toBe(false);
  });

  test("filters name and email as text and role as any select value", () => {
    const filter = (id: string, variant: string, operator: string, value: string) => ({
      filters: [{ id, variant, operator, value }],
    });
    expect(members.safeParse(filter("name", "text", "iLike", "ada")).success).toBe(true);
    expect(members.safeParse(filter("email", "text", "iLike", "ada")).success).toBe(true);
    expect(members.safeParse(filter("role", "select", "eq", "custom-role")).success).toBe(true);
    expect(members.safeParse(filter("organizationId", "text", "eq", "org-b")).success).toBe(false);
    expect(members.safeParse(filter("name", "select", "eq", "ada")).success).toBe(false);
  });
});
