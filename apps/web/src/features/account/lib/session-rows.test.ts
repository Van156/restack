import { describe, expect, test } from "bun:test";

import { toSessionRows, type ListedSession } from "./session-rows";

const CHROME_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

const session = (overrides: Partial<ListedSession> & { id: string }): ListedSession => ({
  token: `token-${overrides.id}`,
  userAgent: CHROME_MAC,
  ipAddress: "203.0.113.7",
  updatedAt: new Date("2026-10-01T10:00:00Z"),
  ...overrides,
});

describe("toSessionRows", () => {
  test("labels the device, keeps the IP and marks the current session by id", () => {
    const rows = toSessionRows([session({ id: "s1" }), session({ id: "s2" })], "s2");
    expect(rows.find((row) => row.id === "s2")).toMatchObject({
      device: "Chrome on macOS",
      ipAddress: "203.0.113.7",
      isCurrent: true,
    });
    expect(rows.find((row) => row.id === "s1")?.isCurrent).toBe(false);
  });

  test("lists the current session first, then the most recently active", () => {
    const rows = toSessionRows(
      [
        session({ id: "old", updatedAt: new Date("2026-09-01T00:00:00Z") }),
        session({ id: "current", updatedAt: new Date("2026-08-01T00:00:00Z") }),
        session({ id: "recent", updatedAt: new Date("2026-09-30T00:00:00Z") }),
      ],
      "current",
    );
    expect(rows.map((row) => row.id)).toEqual(["current", "recent", "old"]);
  });

  test("falls back for a missing user agent or IP, and does not mutate the input", () => {
    const input = [session({ id: "s1", userAgent: null, ipAddress: "" })];
    const [row] = toSessionRows(input, undefined);
    expect(row).toMatchObject({ device: "Unknown device", ipAddress: null, isCurrent: false });
    expect(input[0]?.ipAddress).toBe("");
  });
});
