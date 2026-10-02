import { describe, expect, test } from "bun:test";

import {
  AUDIT_SCOPES,
  userAuditListConfig,
  USER_LOG_ACTIONS,
  orgAuditListConfig,
  ORG_LOG_ACTIONS,
  platformAuditListConfig,
  PLATFORM_LOG_ACTIONS,
} from "./audit-list-config";
import { createListInput } from "./list-input";

const action = (value: string) => ({ id: "action", variant: "select", operator: "eq", value });

describe("audit list configs", () => {
  const org = createListInput(orgAuditListConfig);
  const platform = createListInput(platformAuditListConfig);

  test("default to newest first", () => {
    expect(org.parse({}).sort).toEqual([{ id: "createdAt", desc: true }]);
    expect(platform.parse({}).sort).toEqual([{ id: "createdAt", desc: true }]);
  });

  test("the org list accepts every organization action and no platform action", () => {
    for (const value of ORG_LOG_ACTIONS) {
      expect(org.safeParse({ filters: [action(value)] }).success).toBe(true);
    }
    expect(org.safeParse({ filters: [action("user.banned")] }).success).toBe(false);
  });

  test("the platform list accepts every action and both scopes", () => {
    for (const value of PLATFORM_LOG_ACTIONS) {
      expect(platform.safeParse({ filters: [action(value)] }).success).toBe(true);
    }
    for (const value of AUDIT_SCOPES) {
      const scope = { id: "scope", variant: "select", operator: "eq", value };
      expect(platform.safeParse({ filters: [scope] }).success).toBe(true);
    }
    expect(platform.safeParse({ filters: [action("nope")] }).success).toBe(false);
  });

  test("the org list offers no organization or scope column", () => {
    const organization = { id: "organization", variant: "text", operator: "eq", value: "x" };
    const scope = { id: "scope", variant: "select", operator: "eq", value: "platform" };
    expect(org.safeParse({ filters: [organization] }).success).toBe(false);
    expect(org.safeParse({ filters: [scope] }).success).toBe(false);
    expect(org.safeParse({ sort: [{ id: "scope", desc: false }] }).success).toBe(false);
  });

  test("id columns (actor, organization) are filterable but not sortable", () => {
    expect(platform.safeParse({ sort: [{ id: "actor", desc: false }] }).success).toBe(false);
    expect(platform.safeParse({ sort: [{ id: "organization", desc: false }] }).success).toBe(false);
  });

  test("the user list accepts user actions only, sorts by date or action and defaults to newest first", () => {
    const user = createListInput(userAuditListConfig);
    expect(user.parse({}).sort).toEqual([{ id: "createdAt", desc: true }]);
    for (const value of USER_LOG_ACTIONS) {
      expect(user.safeParse({ filters: [action(value)] }).success).toBe(true);
    }
    expect(user.safeParse({ filters: [action("member.added")] }).success).toBe(false);
    expect(user.safeParse({ sort: [{ id: "action", desc: false }] }).success).toBe(true);
    expect(user.safeParse({ sort: [{ id: "scope", desc: false }] }).success).toBe(false);
  });

  test("the platform list never offers the user scope", () => {
    const scope = { id: "scope", variant: "select", operator: "eq", value: "user" };
    expect(AUDIT_SCOPES).not.toContain("user");
    expect(platform.safeParse({ filters: [scope] }).success).toBe(false);
  });
});
