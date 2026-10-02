import { describe, expect, test } from "bun:test";

import {
  formatAuditAction,
  formatAuditTarget,
  formatUserAuditAction,
  formatUserAuditDetail,
  getActorOptions,
  resolveActorLabel,
} from "./audit-log-display";

describe("resolveActorLabel (R7.4: readable actor for an audit_log row)", () => {
  const members = [
    { userId: "u1", user: { name: "Ada Lovelace", email: "ada@example.com" } },
    { userId: "u2", user: { name: null, email: "no-name@example.com" } },
  ];

  test("prefers the member's name when available", () => {
    expect(resolveActorLabel("u1", members)).toBe("Ada Lovelace");
  });

  test("falls back to email when the member has no name", () => {
    expect(resolveActorLabel("u2", members)).toBe("no-name@example.com");
  });

  test("falls back to a shortened id for a former member no longer in the list", () => {
    expect(resolveActorLabel("u3-not-a-current-member", members)).toBe("u3-not-a…");
  });

  test("null actor (system) reads as System", () => {
    expect(resolveActorLabel(null, members)).toBe("System");
  });
});

describe("formatAuditAction", () => {
  test("replaces dots and underscores with spaces for a readable label", () => {
    expect(formatAuditAction("member.role_changed")).toBe("member role changed");
    expect(formatAuditAction("organization.created")).toBe("organization created");
    expect(formatAuditAction("user.impersonation_started")).toBe("user impersonation started");
  });
});

describe("formatAuditTarget", () => {
  test("shows type and id, type alone, or an em dash", () => {
    expect(formatAuditTarget({ targetType: "member", targetId: "m1" })).toBe("member (m1)");
    expect(formatAuditTarget({ targetType: "member", targetId: null })).toBe("member");
    expect(formatAuditTarget({ targetType: null, targetId: "m1" })).toBe("—");
  });
});

describe("getActorOptions", () => {
  test("labels each member by name, then email, then id", () => {
    expect(
      getActorOptions([
        { userId: "u1", user: { name: "Ada", email: "ada@example.com" } },
        { userId: "u2", user: { name: null, email: "e@example.com" } },
        { userId: "u3", user: { name: "", email: null } },
        { userId: "u4" },
      ]),
    ).toEqual([
      { label: "Ada", value: "u1" },
      { label: "e@example.com", value: "u2" },
      { label: "u3", value: "u3" },
      { label: "u4", value: "u4" },
    ]);
  });
});

describe("formatUserAuditAction", () => {
  test("labels each user-scoped action", () => {
    expect(formatUserAuditAction("user.email_changed")).toBe("Email changed");
    expect(formatUserAuditAction("user.session_revoked")).toBe("Session signed out");
    expect(formatUserAuditAction("user.deleted")).toBe("Account deleted");
  });

  test("falls back to the generic label for an unknown action", () => {
    expect(formatUserAuditAction("user.something_new")).toBe("user something new");
  });
});

describe("formatUserAuditDetail (R7.1)", () => {
  const CHROME_MAC =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

  test("shows old and new email for an email change", () => {
    expect(
      formatUserAuditDetail({
        action: "user.email_changed",
        metadata: { oldEmail: "a@old.test", newEmail: "a@new.test" },
      }),
    ).toBe("a@old.test → a@new.test");
  });

  test("shows the device and IP of a revoked session", () => {
    expect(
      formatUserAuditDetail({
        action: "user.session_revoked",
        metadata: { sessionUserAgent: CHROME_MAC, sessionIp: "203.0.113.7" },
      }),
    ).toBe("Chrome on macOS · 203.0.113.7");
    expect(
      formatUserAuditDetail({
        action: "user.session_revoked",
        metadata: { sessionUserAgent: null, sessionIp: "203.0.113.7" },
      }),
    ).toBe("203.0.113.7");
    expect(formatUserAuditDetail({ action: "user.session_revoked", metadata: {} })).toBeNull();
  });

  test("notes the session revocation of password rows", () => {
    expect(
      formatUserAuditDetail({
        action: "user.password_changed",
        metadata: { otherSessionsRevoked: true },
      }),
    ).toBe("Other sessions were signed out");
    expect(
      formatUserAuditDetail({
        action: "user.password_reset",
        metadata: { allSessionsRevoked: true },
      }),
    ).toBe("All sessions were signed out");
  });

  test("is null for missing, malformed or unrelated metadata", () => {
    expect(formatUserAuditDetail({ action: "user.password_changed", metadata: null })).toBeNull();
    expect(formatUserAuditDetail({ action: "user.email_changed", metadata: "oops" })).toBeNull();
    expect(
      formatUserAuditDetail({ action: "user.deleted", metadata: { userName: "Ada" } }),
    ).toBeNull();
  });
});
