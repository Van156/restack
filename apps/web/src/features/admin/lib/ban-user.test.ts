import { describe, expect, spyOn, test } from "bun:test";

import { settleConfirm } from "@/shared/lib/confirm";

import { getBanUserDialog, type PendingBan } from "./ban-user";

const pending: PendingBan = { userId: "u1", reason: "spam", expiresInSeconds: 3600 };

describe("getBanUserDialog", () => {
  test("names the consequence and the reason; a permanent ban says so", () => {
    expect(getBanUserDialog(pending, async () => {}).description).toContain("spam");
    expect(getBanUserDialog(pending, async () => {}).description).toContain("session");
    const permanent = getBanUserDialog({ userId: "u1", reason: "spam" }, async () => {});
    expect(permanent.description).toContain("until unbanned");
    expect(getBanUserDialog(null, async () => {}).description).toBeUndefined();
  });

  test("confirming bans with the pending values and settles true", async () => {
    const banned: PendingBan[] = [];
    const dialog = getBanUserDialog(pending, async (ban) => void banned.push(ban));
    expect(await settleConfirm(dialog.onConfirm)).toBe(true);
    expect(banned).toEqual([pending]);
  });

  test("a failed ban settles false so the dialog stays open", async () => {
    const spy = spyOn(console, "error").mockImplementation(() => {});
    const dialog = getBanUserDialog(pending, async () => {
      throw new Error("nope");
    });
    expect(await settleConfirm(dialog.onConfirm)).toBe(false);
    spy.mockRestore();
  });

  test("with no pending ban confirming bans nobody", async () => {
    let calls = 0;
    const dialog = getBanUserDialog(null, async () => void calls++);
    expect(await settleConfirm(dialog.onConfirm)).toBe(true);
    expect(calls).toBe(0);
  });
});
