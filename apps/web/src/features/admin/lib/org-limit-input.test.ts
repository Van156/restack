import { describe, expect, test } from "bun:test";

import { parseOrgLimitInput } from "./org-limit-input";

describe("parseOrgLimitInput (R6.6: set a non-negative integer or clear back to the default)", () => {
  test("blank input clears the override", () => {
    expect(parseOrgLimitInput("")).toEqual({ type: "clear" });
    expect(parseOrgLimitInput("   ")).toEqual({ type: "clear" });
  });

  test("a non-negative integer sets the override", () => {
    expect(parseOrgLimitInput("0")).toEqual({ type: "set", value: 0 });
    expect(parseOrgLimitInput("5")).toEqual({ type: "set", value: 5 });
    expect(parseOrgLimitInput("  10  ")).toEqual({ type: "set", value: 10 });
  });

  test("a negative number is invalid", () => {
    const result = parseOrgLimitInput("-1");
    expect(result.type).toBe("invalid");
  });

  test("a decimal is invalid", () => {
    const result = parseOrgLimitInput("1.5");
    expect(result.type).toBe("invalid");
  });

  test("non-numeric text is invalid", () => {
    const result = parseOrgLimitInput("abc");
    expect(result.type).toBe("invalid");
  });
});
