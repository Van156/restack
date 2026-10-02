import { describe, expect, test } from "bun:test";

import { getOrgAuditCsvColumns, getPlatformAuditCsvColumns } from "./audit-log-export";
import { toCsv } from "@/shared/lib/data-table/csv";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "row-1",
  scope: "organization" as const,
  organizationId: "org-1",
  actorUserId: "user-1",
  impersonatorUserId: null,
  action: "member.role_changed",
  targetType: "member",
  targetId: "member-9",
  metadata: null,
  ip: null,
  userAgent: null,
  createdAt: new Date(Date.UTC(2026, 0, 2, 3, 4, 5)),
  ...overrides,
});

describe("audit log CSV columns", () => {
  const members = [{ userId: "user-1", user: { name: "Ada Lovelace", email: "ada@example.com" } }];

  test("org export writes time, actor, action and target", () => {
    const csv = toCsv([row()], getOrgAuditCsvColumns(members));
    expect(csv).toBe(
      "When,Actor,Actor ID,Action,Target type,Target ID\r\n" +
        "2026-01-02T03:04:05.000Z,Ada Lovelace,user-1,member.role_changed,member,member-9\r\n",
    );
  });

  test("an unknown or missing actor is a shortened id or System", () => {
    const csv = toCsv(
      [row({ actorUserId: "abcdefghijkl" }), row({ actorUserId: null })],
      getOrgAuditCsvColumns(members),
    );
    const lines = csv.trim().split("\r\n");
    expect(lines[1]).toContain(",abcdefgh…,abcdefghijkl,");
    expect(lines[2]).toContain(",System,,");
  });

  test("platform export adds scope and organization", () => {
    const csv = toCsv([row()], getPlatformAuditCsvColumns());
    expect(csv.split("\r\n")[0]).toBe(
      "When,Scope,Organization ID,Actor,Actor ID,Action,Target type,Target ID",
    );
    expect(csv.split("\r\n")[1]).toBe(
      "2026-01-02T03:04:05.000Z,organization,org-1,user-1…,user-1,member.role_changed,member,member-9",
    );
  });

  test("text from the log cannot become a formula", () => {
    const csv = toCsv([row({ targetType: "=HYPERLINK(1)" })], getOrgAuditCsvColumns([]));
    expect(csv).toContain("'=HYPERLINK(1)");
  });
});
