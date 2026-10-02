import { describe, expect, test } from "bun:test";

import { AUTH_FORM_FALLBACK_MESSAGE, runAuthAction } from "./run-auth-action";

describe("runAuthAction", () => {
  test("resolves ok on success", async () => {
    expect(await runAuthAction(async () => ({ error: null }))).toEqual({ ok: true });
  });

  test("surfaces the server message from the real flat error shape", async () => {
    const result = await runAuthAction(async () => ({
      error: {
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Invalid email or password",
        status: 401,
        statusText: "Unauthorized",
      },
    }));
    expect(result).toEqual({ ok: false, message: "Invalid email or password" });
  });

  test("a rejected promise (network/offline) yields the fallback instead of throwing", async () => {
    const result = await runAuthAction(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(result).toEqual({ ok: false, message: AUTH_FORM_FALLBACK_MESSAGE });
  });
});
