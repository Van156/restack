import { describe, expect, spyOn, test } from "bun:test";

import { settleConfirm } from "@/shared/lib/confirm";

import { getDeleteRoleDialog } from "./role-deletion";

describe("getDeleteRoleDialog", () => {
  test("names the role in the description", () => {
    expect(getDeleteRoleDialog("auditor", async () => {}).description).toContain('"auditor"');
    expect(getDeleteRoleDialog(null, async () => {}).description).toBeUndefined();
  });

  test("confirming deletes the role by name and settles true", async () => {
    const deleted: string[] = [];
    const dialog = getDeleteRoleDialog("auditor", async (name) => void deleted.push(name));
    expect(await settleConfirm(dialog.onConfirm)).toBe(true);
    expect(deleted).toEqual(["auditor"]);
  });

  test("a failed deletion settles false so the dialog stays open", async () => {
    const spy = spyOn(console, "error").mockImplementation(() => {});
    const dialog = getDeleteRoleDialog("auditor", async () => {
      throw new Error("role still assigned");
    });
    expect(await settleConfirm(dialog.onConfirm)).toBe(false);
    spy.mockRestore();
  });

  test("with no pending role confirming deletes nothing", async () => {
    let calls = 0;
    const dialog = getDeleteRoleDialog(null, async () => void calls++);
    expect(await settleConfirm(dialog.onConfirm)).toBe(true);
    expect(calls).toBe(0);
  });
});
