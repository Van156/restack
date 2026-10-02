import { describe, expect, spyOn, test } from "bun:test";

import { settleConfirm } from "@/shared/lib/confirm";

import { getRemoveMemberDialog, memberDisplayName } from "./member-removal";

const member = { id: "m1", userId: "u1", user: { name: "Ada", email: "ada@example.com" } };

describe("memberDisplayName", () => {
  test("prefers name, then email, then user id", () => {
    expect(memberDisplayName(member)).toBe("Ada");
    expect(memberDisplayName({ ...member, user: { email: "ada@example.com" } })).toBe(
      "ada@example.com",
    );
    expect(memberDisplayName({ id: "m1", userId: "u1" })).toBe("u1");
  });
});

describe("getRemoveMemberDialog", () => {
  test("names the member in the description", () => {
    expect(getRemoveMemberDialog(member, async () => {}).description).toContain("Ada");
    expect(getRemoveMemberDialog(null, async () => {}).description).toBeUndefined();
  });

  test("confirming removes the member by id and settles true", async () => {
    const removed: string[] = [];
    const dialog = getRemoveMemberDialog(member, async (id) => void removed.push(id));
    expect(await settleConfirm(dialog.onConfirm)).toBe(true);
    expect(removed).toEqual(["m1"]);
  });

  test("a failed removal settles false so the dialog stays open", async () => {
    const spy = spyOn(console, "error").mockImplementation(() => {});
    const dialog = getRemoveMemberDialog(member, async () => {
      throw new Error("nope");
    });
    expect(await settleConfirm(dialog.onConfirm)).toBe(false);
    spy.mockRestore();
  });

  test("with no pending member confirming removes nothing", async () => {
    let calls = 0;
    const dialog = getRemoveMemberDialog(null, async () => void calls++);
    expect(await settleConfirm(dialog.onConfirm)).toBe(true);
    expect(calls).toBe(0);
  });
});
