import { describe, expect, test } from "bun:test";

import { nitCheckDigit, parseNit } from "./nit";

describe("nitCheckDigit", () => {
  test("matches the DIAN check digit of known NITs", () => {
    expect(nitCheckDigit("800197268")).toBe(4);
    expect(nitCheckDigit("890903938")).toBe(8);
    expect(nitCheckDigit("860002964")).toBe(4);
  });

  test("a remainder of 0 or 1 is the digit itself", () => {
    expect(nitCheckDigit("900000009")).toBe(0);
    expect(nitCheckDigit("900000002")).toBe(1);
  });
});

describe("parseNit", () => {
  test("accepts dots, spaces and a dash and returns the canonical body-dash-digit form", () => {
    expect(parseNit("800.197.268-4")).toEqual({ ok: true, value: "800197268-4" });
    expect(parseNit(" 800197268 - 4 ")).toEqual({ ok: true, value: "800197268-4" });
    expect(parseNit("8001972684")).toEqual({ ok: true, value: "800197268-4" });
  });

  test("rejects a wrong check digit", () => {
    expect(parseNit("800197268-5")).toEqual({ ok: false, reason: "check_digit" });
  });

  test("rejects letters, short and long numbers", () => {
    expect(parseNit("80019726A-4")).toEqual({ ok: false, reason: "format" });
    expect(parseNit("12-3")).toEqual({ ok: false, reason: "format" });
    expect(parseNit("123456789012-3")).toEqual({ ok: false, reason: "format" });
    expect(parseNit("")).toEqual({ ok: false, reason: "format" });
  });
});
