import { describe, expect, test } from "bun:test";

import { resolveVerifyEmailStatus } from "./verify-email-status";

describe("resolveVerifyEmailStatus", () => {
  test("no error param means success (R0.2)", () => {
    expect(resolveVerifyEmailStatus(undefined)).toBe("success");
    expect(resolveVerifyEmailStatus(null)).toBe("success");
    expect(resolveVerifyEmailStatus("")).toBe("success");
  });

  test("TOKEN_EXPIRED maps to the expired state (R0.4)", () => {
    expect(resolveVerifyEmailStatus("TOKEN_EXPIRED")).toBe("expired");
  });

  test("any other error code maps to the generic invalid state (R0.4)", () => {
    expect(resolveVerifyEmailStatus("INVALID_TOKEN")).toBe("invalid");
    expect(resolveVerifyEmailStatus("something_unexpected")).toBe("invalid");
  });
});
