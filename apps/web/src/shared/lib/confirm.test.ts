import { describe, expect, spyOn, test } from "bun:test";

import { confirmFor, matchesConfirmationPhrase, settleConfirm } from "./confirm";

describe("settleConfirm", () => {
  test("resolves true when a sync handler succeeds", async () => {
    expect(await settleConfirm(() => {})).toBe(true);
  });

  test("resolves true when an async handler succeeds", async () => {
    expect(await settleConfirm(async () => {})).toBe(true);
  });

  test("resolves false, without throwing, when the handler rejects", async () => {
    expect(
      await settleConfirm(async () => {
        throw new Error("nope");
      }),
    ).toBe(false);
  });

  test("resolves false when a sync handler throws", async () => {
    expect(
      await settleConfirm(() => {
        throw new Error("nope");
      }),
    ).toBe(false);
  });

  test("logs the caught error so a failed confirm is never silent", async () => {
    const spy = spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("nope");
    try {
      await settleConfirm(async () => {
        throw failure;
      });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]).toContain(failure);
    } finally {
      spy.mockRestore();
    }
  });
});

describe("confirmFor", () => {
  test("confirming runs the action with the pending target", async () => {
    const seen: string[] = [];
    const settled = await settleConfirm(confirmFor("inv-1", async (id) => void seen.push(id)));
    expect(settled).toBe(true);
    expect(seen).toEqual(["inv-1"]);
  });

  test("a failing action settles to false so the dialog stays open", async () => {
    const originalError = console.error;
    console.error = () => {};
    try {
      const settled = await settleConfirm(
        confirmFor("inv-1", async () => {
          throw new Error("nope");
        }),
      );
      expect(settled).toBe(false);
    } finally {
      console.error = originalError;
    }
  });

  test("without a target nothing runs", async () => {
    let calls = 0;
    const settled = await settleConfirm(confirmFor<string>(null, () => void calls++));
    expect(settled).toBe(true);
    expect(calls).toBe(0);
  });
});

describe("matchesConfirmationPhrase", () => {
  test("matches only the exact phrase", () => {
    expect(matchesConfirmationPhrase("Acme Inc", "Acme Inc")).toBe(true);
  });

  test("rejects a different case, extra whitespace and partial input", () => {
    expect(matchesConfirmationPhrase("acme inc", "Acme Inc")).toBe(false);
    expect(matchesConfirmationPhrase("Acme Inc ", "Acme Inc")).toBe(false);
    expect(matchesConfirmationPhrase("Acme", "Acme Inc")).toBe(false);
  });

  test("never matches an empty phrase", () => {
    expect(matchesConfirmationPhrase("", "")).toBe(false);
  });
});
