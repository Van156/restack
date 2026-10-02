import { describe, expect, test } from "bun:test";

import { isSuperadminRole } from "./platform-role";

describe("isSuperadminRole (R6.5, T9 admin-area guard)", () => {
  test("null/undefined/empty role: not a superadmin", () => {
    expect(isSuperadminRole(null)).toBe(false);
    expect(isSuperadminRole(undefined)).toBe(false);
    expect(isSuperadminRole("")).toBe(false);
  });

  test("plain user role: not a superadmin", () => {
    expect(isSuperadminRole("user")).toBe(false);
  });

  test("exactly superadmin: is a superadmin", () => {
    expect(isSuperadminRole("superadmin")).toBe(true);
  });

  test("multi-role comma-separated (admin-seed's append convention): is a superadmin", () => {
    expect(isSuperadminRole("user,superadmin")).toBe(true);
    expect(isSuperadminRole("superadmin,user")).toBe(true);
  });

  test("whitespace around a comma-separated role is tolerated", () => {
    expect(isSuperadminRole("user, superadmin")).toBe(true);
  });

  test("a role that merely contains the substring is not a match", () => {
    expect(isSuperadminRole("superadmin-readonly")).toBe(false);
  });
});
