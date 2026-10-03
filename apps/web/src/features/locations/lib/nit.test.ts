import { describe, expect, test } from "bun:test";

import { formatNit, parseNit } from "./nit";

describe("parseNit", () => {
  test("canonicalizes dots, spaces, dash and a missing dash", () => {
    expect(parseNit("800.197.268-4")).toEqual({ ok: true, value: "800197268-4" });
    expect(parseNit(" 800197268 - 4 ")).toEqual({ ok: true, value: "800197268-4" });
    expect(parseNit("8001972684")).toEqual({ ok: true, value: "800197268-4" });
    expect(parseNit("890903938-8")).toEqual({ ok: true, value: "890903938-8" });
  });

  test("checks the DV, including remainders 0 and 1", () => {
    expect(parseNit("800197268-5")).toEqual({ ok: false, reason: "check_digit" });
    expect(parseNit("900000009-0")).toEqual({ ok: true, value: "900000009-0" });
    expect(parseNit("900000002-1")).toEqual({ ok: true, value: "900000002-1" });
  });

  test("rejects letters, too short and too long numbers", () => {
    expect(parseNit("80019726A-4")).toEqual({ ok: false, reason: "format" });
    expect(parseNit("12-3")).toEqual({ ok: false, reason: "format" });
    expect(parseNit("123456789012-3")).toEqual({ ok: false, reason: "format" });
    expect(parseNit("")).toEqual({ ok: false, reason: "format" });
  });
});

describe("formatNit", () => {
  test("groups the body with dots and keeps the DV after the dash", () => {
    expect(formatNit("800197268-4")).toBe("800.197.268-4");
  });

  test("returns anything not in canonical form unchanged", () => {
    expect(formatNit("pending")).toBe("pending");
  });
});
